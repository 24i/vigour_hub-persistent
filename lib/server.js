'use strict'

const net = require('net')
const JSONStream = require('JSONStream')
const level = require('./level')

const actions = {
  login (payload, socket) {
    console.log(socket._id, 'login', payload)

    socket._id = payload.id
  },
  save (payload, socket) {
    console.log(socket._id, 'save', payload)

    level.save(socket._id, payload)
      .then(() => {
        console.log(socket._id, 'saved', payload)
      })
      .catch(error => {
        console.log(socket._id, 'save error', payload, error)
      })
  },
  load (payload, socket) {
    console.log(socket._id, 'load', payload)

    level.load(socket._id, payload)
      .then(stream => {
        stream
          .on('data', item => {
            socket.write(JSON.stringify({ action: 'load', payload: item }))
          })
          .on('end', () => {
            console.log(socket._id, 'loaded', payload)
            socket.write(JSON.stringify({ action: 'loaded', payload }))
          })
      })
      .catch(error => {
        console.log(socket._id, 'load error', payload, error)
      })
  }
}

module.exports = port => net.createServer(socket => {
  const parser = socket.pipe(JSONStream.parse(false))

  parser.on('data', data => {
    if (data && data.action && actions[data.action]) {
      actions[data.action](data.payload, socket)
    }
  })
}).listen(port)
