const config = require('../config.json')
const express = require('express')
      , Promise = require('bluebird')
      , router = express.Router()
      , moment = require('moment')
      , jwt = Promise.promisifyAll(require('jsonwebtoken'))

      , knex = require('knex')({
          client: 'mssql',
          connection: {
            host : config.mssql.host,
            user : config.mssql.user,
            password : config.mssql.password,
            database : config.mssql.databse || ''
          }
          // , debug:true
      });
const addWheres = (query, element) => {
  if(element[0] === 'FirstName') query.where(element[0], 'like', `${element[1]}%`)
  else query.where(element[0], element[1])
}


module.exports = () => {
  //-- start writing routes here --
  router.get('/', (req, res) => {
    res.send("api is up and working! authenticated!")
  })
  router.all('/search/', (req, res) => {
    let WhiteList = [
      'SiteID','FirstName', 'MiddleInitial', 'LastName',
      'eMailAddress', 'Birthdate', 'Tel', 'Gender', 'DateCreated', 'CreatedBy',
      'Address', 'City', 'State', 'PostalCode'
    ]

    let columns = [
      'tblPeople.FirstName', 'tblPeople.LastName', 'tblPeople.MiddleInitial', 'tblPeople.eMailAddress', 'tblPeople.Birthdate', 'tblPeople.Tel', 'tblPeople.Gender',
      'tblHH.Address', 'tblHH.City', 'tblHH.State', 'tblHH.PostalCode',
      'tblPeople.DateCreated', 'tblPeople.CreatedBy', 'tblPanelistLookupValues.Description'
    ]


    let query = knex('tblPeople').select(columns)
      .innerJoin('tblHH', 'tblHH.HHID', 'tblPeople.HHID')
      .innerJoin('tblPanelistAttributes', 'tblPeople.PersonID', 'tblPanelistAttributes.PersonID')
      .innerJoin('tblPanelistLookupValues', function() {
        this.on('tblPanelistAttributes.AttributeID', 'tblPanelistLookupValues.AttributeID')
        .andOn('tblPanelistAttributes.Value', 'tblPanelistLookupValues.Value')
        .andOn('tblPanelistAttributes.AttributeID', 76)
      })
      .limit(50).orderBy('LastName')
    Object.entries(req.body).map(item => {
      if(WhiteList.indexOf(item[0])) addWheres(query, item)
    })

    query.then(data => {
      res.json(data)
    })
  })




  router.post('/getUserDetails', (req, res) => {
    if(req.body.id) {
      var getUserStudies = function() {
        return knex('tblPeople').select(
          'tblPeople.PersonID',
          'tblStudies.*'
        ).rightJoin('tblARMPanStudiesOffered', 'tblARMPanStudiesOffered.PanelistID', 'tblPeople.PersonID')
        .innerJoin('tblStudies', 'tblARMPanStudiesOffered.StudyID', 'tblStudies.StudyID')
        .where('tblPeople.PersonID', req.body.id)
      }

      var getUserDetails = function() {
        return knex('tblPeople').select(
          'tblPeople.*'
        ).where('tblPeople.PersonID', req.body.id)
      }

      Promise.join(getUserStudies(), getUserDetails(), function(studies, user) {
        console.log(studies)
        var data = {
          user: user,
          studies, studies
        }
        res.json(data)
      })
    }else {
      res.json({error:'invalid param, missing id'})
    }
  })
  router.get('/profile/:id', (req, res) => {
    // let DataList = ['PersonId', 'ValueDescription', 'Name']
    console.log('fetching data from db...')
    let schemaQuery = knex.raw(`select * from tblPI_Mapping`)

    let query = knex.raw(`select PersonId, LookUpValues.*  from tblPanelistAttributes
                          left join tblPI_Mapping on
                            tblPanelistAttributes.AttributeID = tblPI_Mapping.AttributeId
                            and tblPanelistAttributes.Value = tblPI_Mapping.Value
                          left join (
                            select Description, ClassAttributeName, tblPanelistLookUp.AttributeID, tblPanelistLookupValues.Value, tblPanelistLookUp.ValueType, tblPanelistLookUp.MultiValue from tblPanelistLookUp
                            right join tblPanelistLookupValues on
                              tblPanelistLookUp.AttributeId = tblPanelistLookupValues.AttributeId
                          ) as LookUpValues on
                            LookUpValues.AttributeId = tblPanelistAttributes.AttributeID
                            and LookUpValues.Value = tblPanelistAttributes.Value
                          where PersonId = ${req.params.id}`)

    query.then(data => {
      let person = {}
      data.map(item => {
        if(!person[item.ClassAttributeName]) { // --- if category doesn't exist yet
          if(item.MultiValue == 1) { // --- expecting an array
            person[item.ClassAttributeName] = {
              'values':[]
            }
            person[item.ClassAttributeName].values.push({
              Description:item.Description,
              Value:item.Value
            })
          }else {
            person[item.ClassAttributeName] = {
              'Label': item.Description,
              'AttributeID':item.AttributeID
            }
          }
        }else { // --- category exists already and is an array
          person[item.ClassAttributeName].values.push(item.Description)
        }
        return person
      })
      return person
    }).then(groupedData => {
      res.json(groupedData)
    })
  })
  router.get('/donotcontact', (req, res) => {
    console.log(req.query)
    var query = knex('tblPeople').where('PersonID', '=', req.query.personid)
    req.query.status
      ? query.update('DoNotContact', req.query.status).then(() => res.json({msg: 'update completed'}))
      : res.json({error:'not enough param, update failed'})
  })

  // --- routes for all type of reports ---

  return router;
}
