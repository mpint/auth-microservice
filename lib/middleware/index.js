'use strict';

module.exports = {
  login: require('./login'),
  invalidate: require('./invalidateToken'),
  validate: require('./validateToken'),
  profile: require('./profile'),
  multifactor: require('./multifactor'),
  password: require('./password')
};
