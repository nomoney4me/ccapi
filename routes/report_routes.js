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
  router.all('/report/:type', (req, res) => {
    let query;
    switch (req.params.type) {
      case 'counts':
        query = knex('tblPeople').select('tblPanelistLookupValues.Description')
          .leftJoin('tblPanelistAttributes', 'tblPeople.PersonID', 'tblPanelistAttributes.PersonID')
          .leftJoin('tblPanelistLookupValues', function() {
            this.on('tblPanelistAttributes.AttributeID', 'tblPanelistLookupValues.AttributeID')
            .andOn('tblPanelistAttributes.Value', 'tblPanelistLookupValues.Value')
            .andOn('tblPanelistAttributes.AttributeID', 76)
          }).count('tblPeople.PersonID as Total').groupBy('tblPanelistLookupValues.Description')


        query = knex.raw(`with cte as (select tblPanelistLookupValues.Description, count(tblPanelistAttributes.PersonId) as 'Total' from tblPanelistLookupValues
            left join tblPanelistAttributes on
              tblPanelistAttributes.attributeid = tblPanelistLookupValues.attributeid
              and tblPanelistAttributes.Value = tblPanelistLookupValues.Value
            left join tblPeople on
              tblPanelistAttributes.PersonId = tblPeople.PersonID
            where tblPanelistLookupValues.AttributeId = 76 and tblPeople.DateCreated >= '${req.body.fromDateCreated} 00:00:00' and tblPeople.DateCreated <= '${req.body.toDateCreated} 23:59:59'
            group by tblPanelistLookupValues.Description )

            select tblPanelistLookupValues.Description, cte.total as "Total" from tblPanelistLookupValues
              left join cte on cte.Description = tblPanelistLookupValues.Description
            where tblPanelistLookupValues.AttributeId = 76 and tblPanelistLookupValues.Value < 250
            order by tblPanelistLookupValues.Description asc`)
        break;
      case 'latestusers':
        let columns = [
          'tblPeople.FirstName', 'tblPeople.LastName', 'tblPeople.eMailAddress', 'tblPeople.Birthdate',
          'tblPeople.DateCreated', 'tblPanelistLookupValues.Description as Created By'
        ]

        query = knex('tblPeople').select(columns)
          .innerJoin('tblPanelistAttributes', 'tblPeople.PersonID', 'tblPanelistAttributes.PersonID')
          .innerJoin('tblPanelistLookupValues', function() {
            this.on('tblPanelistAttributes.AttributeID', 'tblPanelistLookupValues.AttributeID')
            .andOn('tblPanelistAttributes.Value', 'tblPanelistLookupValues.Value')
            .andOn('tblPanelistAttributes.AttributeID', 76)
          }).limit(100).orderBy('tblPeople.DateCreated', 'desc')

        if(req.body.DateCreated) {
          query.where('tblPeople.DateCreated', '>', req.body.DateCreated)
        }
        break;
      case 'studies':
        //columns = []
        query = knex.raw(`select
                    s.studyid, s.suspended, s.starttime, s.ExpirationDate, s.StudyDescription, s.url, s.panelsize,
                    s.*
                  from tblstudies as s
                    order by s.studyid desc;`)
        break;
      default:
        break;
    }
    query.then(data => {
      //console.log(query.toString())
      res.json(data)
    })
    .catch(e => {
      console.log({err: e})
    })
  })

  return router;

}
