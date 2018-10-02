
const config = require('../config.json');
console.log(`listening on ${config.app.port}`);

const Promise = require('bluebird')
  , router = require('express').Router()
  , bodyParser = require('body-parser')
  , AD = require('activedirectory2').promiseWrapper
  , jwt = Promise.promisifyAll(require('jsonwebtoken'))
  , { ldap_to_date } = require('time-stamps')
  , moment = require('moment')

module.exports = () => {
  router.get('/listpwexpiration', (req, res) => {
    let ad = new AD({
      url: config.ldap.url,
      baseDN: "OU=CC Users, DC=cc, DC=local",
      username: 't1@cc.local',
      password: ''
    })

    Promise.try(() => {
      var query = "";
      return ad.find()
    })
    .then(result => {
      let users = result.users.map(user => {
        let today = moment()
        let pwdLastSet = moment.utc(ldap_to_date(user.pwdLastSet))
        
	let dayago = today.diff(pwdLastSet, 'days')

        return { 
          sAMAccountName: user.sAMAccountName,
          pwdLastSet: dayago
        }
      })
      return users
    })
    .then(users => {
      res.json(users)
    })
  })

  return router
}
