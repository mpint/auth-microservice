var h = require('../helpers');
var InsufficientRequestParametersError = require('../errors').InsufficientRequestParametersError;

/*
  verify the validity of an accessToken
 */
exports.init = function(req, res, next) {
  var client = req.app.get('stormpathClient');
  var userAccessToken = h.parseAuthorizationHeader(req.headers);

  if (!userAccessToken || !req.body.id) return next( new InsufficientRequestParametersError() );

  return h.getUserAccount(client, req.body.id)
    .then(h.getAccessTokens)
    .then(h.resolveAccessToken.bind(null, userAccessToken))
    .then(h.deleteAccessToken)
    .then(next)
    .catch((err) => next(err));
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
