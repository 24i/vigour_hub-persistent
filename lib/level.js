'use strict'

const level = require('level')

const options = {
  keyEncoding: 'json',
  valueEncoding: 'json'
}

const getDb = name => new Promise((resolve, reject) => level(
  `./${name}`, options, (error, db) => error ? reject(error) : resolve(db)
))

exports.save = (id, payload) => Promise.all([ getDb(id), getDb(`${id}-timeline`) ])
  .then(dbs => {
    const [ db, tldb ] = dbs


  })
