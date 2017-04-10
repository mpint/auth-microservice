var env = require('../../config');

module.exports = {
  MissingAccessTokenError: function MissingAccessTokenError() {
    this.name = 'MissingAccessTokenError';
    this.message = env.missingAccessTokenMessage;
  },
  ExpiredAccessTokenError: function ExpiredAccessTokenError() {
    this.name = 'ExpiredAccessTokenError';
    this.message = env.expiredAccessTokenMessage;
  },
  InvalidAccessTokenError: function InvalidAccessTokenError() {
    this.name = 'InvalidAccessTokenError';
    this.message = env.invalidAccessTokenMessage;
  },
  NoStoredAccessTokenError: function NoStoredAccessTokenError() {
    this.name = 'NoStoredAccessTokenError';
    this.message = env.noStoredAccessTokenMessage;
  },
  InsufficientRequestParametersError: function InsufficientRequestParametersError() {
    this.name = 'InsufficientRequestParametersError';
    this.message = env.insufficientRequestParametersMessage;
  },
};

Object.keys(module.exports).forEach(function (methodName) {
  require('util').inherits(module.exports[methodName], Error);
})
