var stormpath = require('express-stormpath');
var login = require('../lib/middleware').login;

module.exports = function(env, app, db) {
  return stormpath.init(app, {
    apiKey: {
      id: env.STORMPATH_CLIENT_APIKEY_ID,
      secret: env.STORMPATH_CLIENT_APIKEY_SECRET
    },
    application: {
      href: env.STORMPATH_APPLICATION_HREF
    },
    cacheOptions: {
      client: db,
      store: 'redis',
      tti: env.redis.tti,
      ttl: env.redis.ttl
    },
    expand: {
      customData: true,
      refreshTokens: true,
      accessTokens: true
    },
    preLoginHandler: login.preLoginHandler,
    postLoginHandler: login.postLoginHandler,
    web: {
      // https://docs.stormpath.com/nodejs/express/latest/configuration.html#single-page-applications
      produces: ['application/json'],
      // https://docs.stormpath.com/nodejs/express/latest/authentication.html#configuring-cookie-flags
      accessTokenCookie: {
        path: '/',
        domain: null,
        httpOnly: true,
        secure: null
      },
      refreshTokenCookie: {
        path: '/',
        domain: null,
        httpOnly: true,
        secure: null
      },
      oauth2: {
        password: {
          // https://docs.stormpath.com/nodejs/express/latest/authentication.html#token-validation-strategy
          validationStrategy: 'stormpath'
        }
      }
    }
  });
}
