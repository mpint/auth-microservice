var env = require('../config');
var redis = require('../db/redis');
var requester = require('../lib/requester');
var base64 = require('js-base64').Base64;
var stormpath = require('stormpath');
var _ = require('lodash');

var errors = require('./errors');
var ExpiredAccessTokenError = errors.ExpiredAccessTokenError;
var InvalidAccessTokenError = errors.InvalidAccessTokenError;
var NoStoredAccessTokenError = errors.NoStoredAccessTokenError;
var MissingAccessTokenError = errors.MissingAccessTokenError;
var InsufficientRequestParametersError = errors.InsufficientRequestParametersError;

/*
  get the stormpath application for a request
  https://docs.stormpath.com/nodejs/jsdoc/index.html
 */
exports.stormpathApplication = function stormpathApplication(client) {
  return new Promise(function(resolve, reject) {
    client.getApplication(
      client.config.application.href,
      function stormpathApplicationCallback(err, application) {
        if (err) reject(err);
        else resolve(application);
      }
    )
  });
}

/*
  get a user's account from stormpath
  accountId can either be an id fragment or a full href
 */
exports.getUserAccount = function getUserAccount (client, accountId, expansionOptions) {
  expansionOptions = expansionOptions || {};

  var accountHref = accountId.includes('api.stormpath.com') ?
    accountId :
    `https://api.stormpath.com/v1/accounts/${accountId}`;

  return new Promise(function(resolve, reject) {
    client.getAccount(accountHref, expansionOptions, function(err, account) {
      if (err) reject(err);
      else resolve(account);
    });
  });
}

exports.getAccessTokens = function getAccessTokens(account) {
  return new Promise((resolve, reject) => {
    account.getAccessTokens(null,
      function getAccessTokensCalback(err, tokens) {
        if (err) reject(err);
        else resolve(tokens.items);
      });
  });
}

exports.deleteAccessToken = function deleteAccessToken(token) {
  return new Promise((resolve, reject) => {
    token.delete(function accessTokenDeleteCallback(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

exports.resolveAccessToken = function resolveAccessToken(userAccessToken, accessTokenList) {
  try {
    var matchedToken = _.find(accessTokenList, { jwt: userAccessToken });

    if (!matchedToken) throw new NoStoredAccessTokenError();

    return matchedToken;
  } catch (err) {
    throw err;
  }
}

/*
  issue a multifactor challenge to a user
 */
exports.challengeFactor = function challengeFactor (username, factorHref) {
  return redis.getObjAsync(username)
    .then(function(stored) {

      return requester.post(
        factorHref,
        { message: env.multifactorChallengeMessage.default },
        { headers: authHeader({ 'Content-Type': 'application/json' }) }
      )
      .then(function (res) { return res.data; })
      .catch(function(err) { throw err; });
    });
}

/*
  post a response to an issued multifactor challenge
 */
exports.postChallengeResponse = function postChallengeResponse(challengeHref, challengeResponse) {
  return requester.post(
      challengeHref,
      { code: challengeResponse },
      { headers: authHeader() }
    )
    .then(function (res) { return res.data; })
    .catch(function(err) { throw err; });
}

/*
  fetch a list of recent challenges in order to determine if multifactor is required
 */
exports.fetchRecentChallenges = function fetchRecentChallenges(recentChallengeHrefList) {
  return Promise.all(
    recentChallengeHrefList.map(function (href) {
      return requester.get( href, { headers: authHeader() } )
    })
  )
  .then(function (responseList) {
    return responseList
      .filter(function (response) { return response.data.status === 'SUCCESS'; })
      .map(function (successful) { return successful.data.modifiedAt; });
  })
  .catch(function(err) { throw err; });
}

/*
  parse an accessToken:refreshToken pair from stormpath

    rawHeader = [
  'access_token=<ACCESS_TOKEN>; path=/; expires=Tue, 25 Oct 2016 00:55:27 GMT; httponly',
  'refresh_token=<REFRESH_TOKEN>; path=/; expires=Tue, 25 Oct 2016 01:00:27 GMT; httponly'
  ]
 */
exports.parseTokenHeader = function parseTokenHeader (rawHeaderArray) {
  return rawHeaderArray.reduce(function(out, header) {
    var temp = {};
    var key = _.camelCase(header.split('=')[0]);
    var token = header.split('=')[1].split(';')[0];

    temp[key] = token;

    return _.extend( out, temp );
  }, {});
}

exports.parseAuthorizationHeader = function parseAuthorizationHeader(headers) {
  try {
    return headers.authorization.split('Bearer ')[1];
  } catch (err) {
    throw new MissingAccessTokenError();
  }
}

/*
  get user info from redis
 */
exports.getUserInfo = function getUserInfo(username) {
  return redis.getObjAsync(username);
}

/*
  set a field or fields for a username in redis
 */
exports.setUserInfo = function setUserInfo (username, userInfo) {
  if (!username) throw new Error('username must be defined');
  if (!_.isPlainObject(userInfo)) throw new Error('userInfo must be an object');

  redis.hmset(
    username,
    _.chain(userInfo)
      .toPairs()
      .flatten()
      .value()
  );
}

/*
  set an accessToken: refreshToken pair in redis
 */
exports.setAccessToken = function setAccessToken (key, value) {
  redis.set( key, value );
}

/*
  get a refreshToken with an accessToken from redis
 */
exports.getRefreshToken = function getRefreshToken (key) {
  return redis.getAsync( key.toString() )
    .then((token) => {
      if (!token) throw new ExpiredAccessTokenError();
      else return token;
    })
    .catch((err) => { throw err; })
}

/*
  destroy an accessToken: refreshToken pair in redis
 */
exports.removeAccessToken = function removeAccessToken (key) {
  redis.del(key.toString());
}

/*
  make a pretty timestamp for logging
 */
exports.timestamp = function timestamp () {
  var timezone = 'PST';
// Create a date object with the current time
  var now = new Date();

// Create an array with the current month, day and time
  var date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ];

// Create an array with the current hour, minute and second
  var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];

// Determine AM or PM suffix based on the hour
  var suffix = ( time[0] < 12 ) ? 'AM' : 'PM';

// Convert hour from military time
  time[0] = ( time[0] < 12 ) ? time[0] : time[0] - 12;

// If hour is 0, set it to 12
  time[0] = time[0] || 12;

// If seconds and minutes are less than 10, add a zero
  for ( var i = 1; i < 3; i++ ) {
    if ( time[i] < 10 ) {
      time[i] = '0' + time[i];
    }
  }

// Return the formatted string
  return date.join('/') + ' ' + time.join(':') + ' ' + suffix + ' ' + timezone;
}

/*
  make a stormpath auth header
 */
function authHeader(customHeaders) {
  var defaults = {
    'Cache-Control': 'no-cache',
    Authorization: [ 'Basic', base64.encode(env.STORMPATH_CLIENT_APIKEY_ID + ':' + env.STORMPATH_CLIENT_APIKEY_SECRET) ].join(' ')
  };

  return _.extend(defaults, customHeaders);
}

/**
 * determine whether an object is a Node Response
 * @param  {object}  obj test object
 * @return {boolean}     is object a node response?
 */
function isResponse(obj) {
  return !!(obj.request && obj.headers) ||
    !!(obj.config && obj.response);
}

/*
  if error is a response, respond with the response error, otherwise 500
 */
exports.handleError = function handleError(res, err) {
  if ( isResponse(err) ) {
    var statusCode = (err.response && err.response.status) || (err.data && err.data.status);
    var message = err.response && err.response.data.message;
    var boomed = res.boom.create(statusCode, message);

    res.status(boomed.output.statusCode).send(boomed.output.payload);
  } else if (
    err instanceof ExpiredAccessTokenError ||
    err instanceof InvalidAccessTokenError ) {
      res.boom.forbidden(err.message);
  }
  else if ( err instanceof NoStoredAccessTokenError ) {
    res.boom.notFound(err.message);
  }
  else if ( err instanceof InsufficientRequestParametersError ) {
    res.boom.badData(err.message);
  }
  else {
    res.boom.internal(err);
  }
}

exports.userProfile = function userProfile(account, multifactor, accessToken) {
  // href looks like href: "https://api.stormpath.com/v1/accounts/3hR03pOc3QhoD1X8pe5WjG"
  var hrefArray = account.href.split('/');
  var id = hrefArray[hrefArray.length - 1];

  delete account.customData.href;

  var profile = _.extend(
    {
      id: id,
      username: account.username,
      email: account.email,
      givenName: account.givenName,
      middleName: account.middleName,
      surname: account.surname,
      fullName: account.fullName,
      status: account.status,
      createdAt: account.createdAt,
      modifiedAt: account.modifiedAt,
      passwordModifiedAt: account.passwordModifiedAt,
      emailVerificationStatus: account.emailVerificationStatus,
      emailVerificationToken: account.emailVerificationToken
    },
    account.customData
  );

  return _.extend(
    { multifactor: multifactor },
    { profile: profile },
    { accessToken: accessToken || null }
  );
};
