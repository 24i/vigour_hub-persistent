'use strict'

const test = require('tape')
const hub = require('hub.js')
const pServer = require('../lib/server')

test('dirty check', t => {
  var server = pServer(9090)

  const dataHub = hub({
    port: 9595,
    inject: require('../')
  })

  const client = hub({
    url: 'ws://localhost:9595',
    context: false
    // context: 'someKey'
  })

  dataHub.set({
    persistent: {
      id: 'dataHub',
      server: {
        port: 9090,
        host: 'localhost'
      }
    }
  })

  setTimeout(() => {
    dataHub.set({
      persistent: {
        server: {
          port: null,
          host: null
        }
      }
    })
  }, 1000)

  setTimeout(() => {
    dataHub.set({
      persistent: {
        server: {
          port: 9091,
          host: 'localhost'
        }
      }
    })
  }, 2000)

  setTimeout(() => {
    server.close()
  }, 3000)

  setTimeout(() => {
    dataHub.set({
      persistent: {
        server: {
          port: 9090,
          host: 'localhost'
        }
      }
    })
  }, 4000)

  setTimeout(() => {
    server = pServer(9090)

    client.set({
      someData: { to: 'test' },
      someOther: 'data',
      andAnother: { pathOne: 2, pathTwo: 1 }
    })
  }, 5000)

  setTimeout(() => {
    dataHub.get('persistent').load(false)
      .then(() => {
        console.log('load promise resolved')
        client.set(null)
        dataHub.set(null)
        server.close()
        t.end()
      })
      .catch(error => {
        console.log('failed loading', error)
      })
  }, 6000)
})
