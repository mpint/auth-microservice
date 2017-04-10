var njwt = require('njwt');
var stormpath = require('stormpath');
var env = require('../../config');
var h = require('../helpers');
var _ = require('lodash');

/*
  multifactor entry point
    stores accessToken for user in redis until multifactor is sucessful
    gets user account from stormpath
    determines if multifactor is required
      if it is, do multifactor
      if it isn't, returns account
 */
exports.init = function(client, account, tokens) {
  var username = account.username;

  h.setUserInfo(
    username,
    { accessToken: tokens.accessToken }
  );

  return h.getUserAccount(client, account.href, { expand: 'factors' })
    .then(multifactorResolver)
    .then(multifactorRouter.bind(undefined, client))
    .catch(function(err) { throw err; });
}

/*
  verifies a user response to an issued challenge
 */
exports.verify = function(req, res, next) {
  doChallengeResponseWorkflow(req.body)
    .then(function challengeResponseWorkflowCallback(challengeResponse) {
      res.locals.challengeResponse = challengeResponse;
      next();
    })
    .catch(function(err) { next(err); });
}

/*
  onSuccess middleware
    if allow = true, return token,
    else return 403
 */
exports.onSuccess = function(req, res, next) {
  res.locals.challengeResponse.allow ?
    res.status(200).send( res.locals.challengeResponse ) :
    res.boom.forbidden();
}

/*
  onError middleware
 */
exports.onError = function(err, req, res, next) {
  h.handleError(res, err);
}

/*
  determines if multifactor is necessary
    fetches a list of recent challenges
      if list contains successful challenges that are more recent than multifactor threshold, passthrough
      otherwise, do multifactor
 */
function multifactorResolver(account) {
  if (env.GLOBAL_FORCE_MULTIFACTOR) {
    return { multifactorRequired: true, account: account };
  } else if (account.customData && account.customData.bypassMultifactor) {
    return { multifactorRequired: false, account: account };
  }

  var challengeHrefList = account.factors.items.map(function (factor) {
    return factor.mostRecentChallenge && factor.mostRecentChallenge.href;
  });

  return h.fetchRecentChallenges(
    _.compact(challengeHrefList)
  )
  .then(function (successfulChallengeList) {
    if (!successfulChallengeList.length) return _.extend({ multifactorRequired: true }, { account: account });

    // check if any successful challenges are newer than the multifactor threshold
    var userHasRecentChallenge = successfulChallengeList.some(function (timestamp) {
      var now = Date.now();
      var challengeDate = new Date(timestamp).getTime();
      var timeSinceLastChallenge = (now - challengeDate) / 1000;
      var threshold = env.MULTIFACTOR_REQUIRED_THRESHOLD;

      return timeSinceLastChallenge < threshold;
    });

    return {
      multifactorRequired: !userHasRecentChallenge,
      account: account
    };
  });
}

/*
  routes multifactor workflow based on users factors
    if 0, passthrough
    if 1, challenge the device
    if more, do something fancy
 */
function multifactorRouter(client, resolved) {
  // TODO cases:
  // has google authentication
  // has both google auth and sms (default to gauth, allow option to choose sms)
  // has multiple sms and no google auth (return list of phones)

  var account = resolved.account;
  var factorList = account.factors.items;

  switch (factorList.length) {
    case 0:
      return { numFactors: factorList.length, factorTypes: [], allow: resolved.multifactorRequired };
    case 1:
      var factor = factorList[0];
      return resolved.multifactorRequired ?
        challengeFactor(account.username, factor)
          .then(function challengeFactorCallback(challenge) {
            return _.extend(
              { numFactors: factorList.length, factorTypes: [ factor.type ],  allow: false },
              { challengeHref: challenge.href }
            );
          }) :
        { numFactors: factorList.length, factorTypes: [ factor.type ],  allow: true };
    case 2:
      return handleTwoFactors(client, factorList);
    default:
      throw new Error('not a valid number of factors');
  }
}

/*
  issue a challenge to a users factor
 */
function challengeFactor(username, factor) {
  return h.challengeFactor(username, factor.challenges.href)
    .then(function(challenge) {
      h.setUserInfo(
        username, { challengeHref: challenge.href }
      );

      return challenge;
    });
}

/*
  handle a users response to an issued challenge
    if answer is correct, issue the stored accessToken
    TODO:// there is a potential security issue here
      if payload.username is different from the account that is being challenged,
      it will return the accessToken of payload.usernames's account.
      instead, we need to look up the account that is being challenged and compare it to payload.username
      and throw an error if they dont match
 */
function doChallengeResponseWorkflow(payload) {
  return h.postChallengeResponse(payload.challengeHref, payload.challengeResponse)
    .then(function (response) {
      var isAllowed = response.status === 'SUCCESS';

      return h.getUserInfo(payload.username)
        .then(function (user) {
          var accessToken = isAllowed ?
            user && user.accessToken || 'invalid username' :
            null;

          return {
            allow: isAllowed,
            accessToken: accessToken
          };
        });
    });
}
