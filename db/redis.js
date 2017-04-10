var redis = require('redis');
var bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var client = redis.createClient();

/*
  promises a hashkey from redis
 */
client.getObjAsync = function (key) {
  return new Promise((resolve, reject) => {
    this.hgetall(key, function (err, obj) {
      if (err) reject(err);
      else resolve(obj);
    });
  });
}

module.exports = client;
