'use strict';

var env = require('./config');
var helmet = require('helmet')
var express = require('express');
var bodyParser = require('body-parser');
var stormpath = require('./lib/stormpath');
var routes = require('./lib/routes');
var db = require('./db/redis');

var boom = require('express-boom');

/**
 * Create the Express application.
 */
var app = express();

/**
 * Application settings.
 */
app.set('trust proxy',true);

app.locals.siteName = env.appName;


/*
  hard hat area ahead
 */
app.use(helmet());

/*
  parse request body
*/
app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

/*
  boom error handling
 */
app.use(boom());

/**
 * Stormpath initialization
 */

console.log('Initializing Stormpath');

app.use(stormpath(env, app, db));

/**
 * Route initialization.
 */
app.use('/', routes);

app.on('stormpath.ready',function () {
  console.log('Stormpath Ready');
});

/**
 * Start the web server.
 */
var port = process.env.PORT || 4000;
app.listen(port, function () {
  console.log('Server listening on http://localhost:' + port);
});

process.on('uncaughtException', function(err) {
  console.log(err.stack);
  process.exit(1);
});
