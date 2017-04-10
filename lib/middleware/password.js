var h = require('../helpers');
/*
TODO: build this out
 */
/*
  change your password
 */
exports.change = function(req, res, next) {
  var client = req.app.get('stormpathClient');
}

/*
  reset your password
 */
exports.reset = function(req, res, next) {
  var client = req.app.get('stormpathClient');
}

/*
  password onSuccess middleware
 */
exports.onSuccess = function(req, res, next) {
  res.sendStatus(200);
}

/*
  password onError middleware
 */
exports.onError = function(err, req, res, next) {
  h.handleError(res, err);
}
