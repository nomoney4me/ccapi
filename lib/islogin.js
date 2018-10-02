const config = require('../config.json');
let express = require('express')
	, router = express.Router()
	, Promise = require('bluebird')
	, jwt = Promise.promisifyAll(require('jsonwebtoken'))

module.exports = function(req, res, next) {
    var token = req.body.t || req.query.t || req.headers['x-access-token'];
    if(token) {
      jwt.verifyAsync(token, config.jwt.secret).then(data => {
        next()
      }).catch(err => {
        res.status(401).json({err:'token expired'})
      })
    }else {
			res.status(401).json({err:'unauthorized'})
    }
}
