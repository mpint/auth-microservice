var njwt = require('njwt');
var stormpath = require('stormpath');
var env = require('../../config');
var h = require('../helpers');
var InvalidAccessTokenError = require('../errors').InvalidAccessTokenError;

/*
  verify the validity of an accessToken
 */
exports.verify = function(req, res, next) {
  var bearerToken = req.headers.authorization.split('Bearer ')[1];
  njwt.verify(
    bearerToken,
    env.STORMPATH_CLIENT_APIKEY_SECRET,
    function tokenVerificationCallback(err, verifiedJwt) {
      if (err) {
        next( new InvalidAccessTokenError() );
      }
      else if (tokenIsExpiringSoon(verifiedJwt)) {
        var client = req.app.get('stormpathClient');

        doRefreshTokenWorkflow(client, bearerToken)
          .then(setResponseHeader.bind(undefined, res))
          .then(next)
          .catch(function(err) { next(err) });

      } else { next(); }
    });
}

/*
  validate onSuccess middleware
 */
exports.onSuccess = function(req, res, next) {
  res.sendStatus(200);
}

/*
  validate onError middleware
 */
exports.onError = function(err, req, res, next) {
  h.handleError(res, err);
}

/*
  set Access-Token header
 */
function setResponseHeader(res, pair) {
  res.set('Access-Token', pair.accessToken);
}

/*
  determine if an accessToken is within the expiration threshold
  * used to conditionally issue a refreshToken
 */
function tokenIsExpiringSoon(accessToken) {
  var now = Date.now() / 1000;
  var expires = Number(accessToken.body.exp);
  var threshold = env.ACCESS_TOKEN_REFRESH_THRESHOLD;

  return expires - now < threshold;
}

/*
  workflow for fetching a new accessToken
 */
function doRefreshTokenWorkflow(client, token) {
  return (
    h.getRefreshToken( token )
      .then(removeStaleAccessTokenFromCache.bind(undefined, env.redis.REMOVE_STALE_TOKENS, token))
      .then(fetchRefreshedAccessToken.bind(undefined, client))
      .then(addRefreshedTokenToCache)
    );
}

/*
  remove outdated access token when a new token is issued to keep redis looking nice
 */
function removeStaleAccessTokenFromCache(isToggled, oldAccessToken, refreshToken) {
  if (isToggled) {
    // remove the token after a few seconds to allow any bundled requests to validate correctly
    setTimeout(function() {
      h.removeAccessToken( oldAccessToken );
    }, 5000);
  }

  return refreshToken;
}

/*
  fetch a new access token with a refresh token
 */
function fetchRefreshedAccessToken(client, refreshToken) {
  return new Promise(function(resolve, reject) {
    return h.stormpathApplication(client)
      .then(function(application) {
        var authenticator = new stormpath.OAuthRefreshTokenGrantRequestAuthenticator(application);

        authenticator.authenticate({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }, function(err, result) {
          if (err) return reject(err);
          else resolve(result.accessTokenResponse);
        });
      })
      .catch(function(err) {
        reject(err);
      })
    }
  );
}

/*
  add an accessToken:refreshToken pair to redis
 */
function addRefreshedTokenToCache(pair) {
  h.setAccessToken( pair.access_token, pair.refresh_token );

  return {
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token
  };
}
