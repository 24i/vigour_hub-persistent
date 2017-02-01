'use strict'

const test = require('tape')
const hub = require('hub.js')

test('dirty check', t => {
  const dataHub = hub({
    port: 9595,
    inject: require('../')
  })

  const client = hub({
    url: 'ws://localhost:9595',
    context: false
  })

  dataHub.set({
    persistent: {
      bucket: 'testBucket',
      nodes: [ '127.0.0.1' ]
    }
  })

  dataHub.get(['persistent', 'connected'])
    .once(true)
    .then(() => {
      t.pass('connected to riak')
      client.set({
        someData: { to: 'test' },
        someOther: 'data',
        andAnother: { pathOne: 2, pathTwo: 1 }
      })
    })

  setTimeout(() => {
    client.set(null)
    dataHub.set(null)
    t.end()
  }, 3e3)

  /*
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

  */
})
