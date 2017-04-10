var h = require('../helpers');
var multifactor = require('./multifactor');
var _ = require('lodash');
/*
  log out an attempted login
 */
exports.preLoginHandler = function (attempted, req, res, next) {
  console.log(`[ ${h.timestamp()} ] Login attempt: ${ attempted.username }`);
  next();
}

/*
  post-login logic handler
    determines whether multifactor is necessary
    if it is, return multifactor payload
    if its not, return account
 */
exports.postLoginHandler = function (account, req, res, next) {
  function handleMultifactorPassthrough(account, multifactor, tokens) {
    console.log(`[ ${h.timestamp()} ] Multifactor not required: ${ account.username } (${account.email})`);
    console.log(`[ ${h.timestamp()} ] Login success: ${ account.username } (${account.email})`);
    res.json( h.userProfile(account, multifactor, tokens.accessToken) );
  }

  function handleMultifactorRequired(account, multifactor) {
    console.log(`[ ${h.timestamp()} ] Multifactor required: ${ account.username } (${account.email})`);

    res.json( h.userProfile(account, multifactor) );
  }

  var tokens = h.parseTokenHeader( res.get('set-cookie') );
  var client = req.app.get('stormpathClient');

  multifactor.init(client, account, tokens)
    .then(function multifactorInitCallback(multifactor) {
      // this sets an accessToken: refreshToken pair for quick refresh token lookup on each request
      h.setAccessToken(
        tokens.accessToken,
        tokens.refreshToken
      );

      if (multifactor.allow) {
        handleMultifactorPassthrough(account, multifactor, tokens);
      } else {
        handleMultifactorRequired(account, multifactor);
      }
    })
    .catch(h.handleError.bind(undefined, res));
}
