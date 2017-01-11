'use strict'

const net = require('net')
const JSONStream = require('JSONStream')

const actions = {
  login (payload, socket) {
    console.log(socket._id, 'login', payload)
    socket._id = payload.id
  },
  save (payload, socket) {
    console.log(socket._id, 'save', payload)
  },
  load (payload, socket) {
    console.log(socket._id, 'load', payload)
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
