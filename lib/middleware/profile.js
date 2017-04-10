var njwt = require('njwt');
var stormpath = require('stormpath');
var h = require('../helpers');
var env = require('../../config');

exports.onSuccess = function (req, res, next) {
  if (req.user) {
    delete req.user.customData.href;

    res.send(
      h.userProfile(req.user)
    );
  } else {
    res.boom.forbidden();
  }
};

exports.onError = function(err, req, res, next) {
  console.log('profile fetch error', err);
  res.boom.internal();
};

exports.update = function(req, res, next) {
  for (var key in req.body) {
    req.user.customData[key] = req.body[key];
  }

  req.user.customData.save(function(err) {
    if (err) {
      return next(err);
    }
  });
}
