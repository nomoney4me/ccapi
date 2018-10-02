const config = require('./config.json');
console.log(`listening on ${config.app.port}`);

const Promise = require('bluebird')
  , express = require('express')
  , app = express()
  , session = require('express-session')
  , bodyParser = require('body-parser')
  , AD = require('activedirectory2').promiseWrapper
  , jwt = Promise.promisifyAll(require('jsonwebtoken'))
  , { ldap_to_date } = require('time-stamps')
  , moment = require('moment')
  , cors = require('cors')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(cors())


app.post('/auth', (req, res) => {
  console.log(moment().format('MM-DD-YYYY HH:mm:ss: '), 'authenticating - ', req.body.username)

  var user = {}
  if (req.body.username.match('@')) {
    user = {
      username: req.body.username,
      password: req.body.password
    }
  } else {
    user = {
      username: `${req.body.username}@company.local`,
      password: req.body.password
    }
  }

  let ad = new AD({
    url: config.ldap.url,
    baseDN: config.ldap.dn,
    username: user.username,
    password: user.password
  })

  return Promise.try(() => {
    return ad.authenticate(user.username, user.password)
  }).then((authenticated) => {
    return ad.findUser(user.username)
  }).then((user) => {
    let payload = {
      user: user.sAMAccountName,
      email: user.mail,
      isAdmin: false
    }
    if (user.description) {
      let arcsidArray = user.description.split(';').filter(item => {
        return item.match(/arcsid/)
      })
      payload.arcsid = arcsidArray[0].split(':')[1]
    }
    if (payload.arcsid && payload.user && payload.email) {
      let adminArray = ['']

      if(adminArray.indexOf(payload.user) >= 0) {
        payload.isAdmin = true;
      }

      let token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: 1800
      })
      res.status(200).json({
        success: true,
        message: "Here's your token",
        token: token
      })
    }
  }).catch((error) => {
    if (error.lde_message) res.status(401).json({
      error: 'invalid credentials'
    })
    else res.status(500).json(error)
  })
})

app.use('/', require('./lib/islogin'), require('./routes/adapi_routes')());
app.use('/arcs', require('./lib/islogin'), require('./routes/arcsapi_routes')());
app.use('/arcs', require('./lib/islogin'), require('./routes/report_routes')());

app.listen(config.app.port)
