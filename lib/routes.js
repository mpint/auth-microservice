'use strict';

var express = require('express');
var stormpath = require('express-stormpath');
var middleware = require('./middleware');

/**
 * Create an Express Router, to contain our custom routes.
 */
var router = express.Router();

/**
 * Get a users profile
 */
router.get('/profile', stormpath.getUser, middleware.profile.onSuccess, middleware.profile.onError);

/**
* When someone posts the profile form, read the data and save it to the
* custom data object on the account.  The body-parser library is used
* for parsing the form data.
*/
router.post('/reset-password', stormpath.loginRequired, middleware.password.reset);

router.post('/change-password', stormpath.loginRequired, middleware.password.change);
/**
* validate an accessToken
*/
router.post('/validate-token', middleware.validate.verify, middleware.validate.onSuccess, middleware.validate.onError);

/**
* answer a multifactor challenge
*/
router.post('/multifactor', middleware.multifactor.verify, middleware.multifactor.onSuccess, middleware.multifactor.onError);
router.post('/invalidate-token', middleware.invalidate.init, middleware.invalidate.onSuccess, middleware.invalidate.onError);


module.exports = router;
