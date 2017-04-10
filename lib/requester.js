var env = require('../config');
var axios = require('axios');
var requester = axios.create();

requester.interceptors.request
  .use(
    noopSuccess,
    noopError
  );

requester.interceptors.response
  .use(
    noopSuccess,
    noopError
  );

function sliceStormpathHref(response) {
  console.log('response', response);
  return response;
}

function noopSuccess(response) {
  return response;
}

function noopError(err) {
  throw err;
}

module.exports = requester;
