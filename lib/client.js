'use strict'

const net = require('net')
const JSONStream = require('JSONStream')

function stopTimer (server) {
  if (server.get('timeout')) {
    clearTimeout(server.get('timeout'))
  }
}

function disconnect (server) {
  var connection = server.get('connection')

  stopTimer(server)

  if (['connecting', 'connected'].indexOf(server.get('status').compute()) > -1) {
    connection.destroy()
    server.set({ status: 'idle' })
  }
}
exports.disconnect = disconnect

function tryConnect (server) {
  var connection = server.get('connection')
  const s = server.serialize()

  stopTimer(server)

  if (!s.host || !s.port) {
    return
  }

  if (['connecting', 'connected'].indexOf(s.status) > -1) {
    connection.destroy()
  }

  server.set({ status: 'ready' })
  connect(server)
}
exports.tryConnect = tryConnect

function connect (server) {
  var connection = server.get('connection')
  const s = server.serialize()
  const root = server.get('root')

  if (['ready', 'retry'].indexOf(s.status) < 0) {
    return
  }

  connection = net.connect(s.port, s.host, () => {
    stopTimer(server)

    server.set({ status: 'connected' })

    const parser = connection.pipe(JSONStream.parse(false))
    parser.on('data', (data) => server.emit(data.action, data.payload))

    connection.write(JSON.stringify({
      action: 'login',
      payload: {
        id: server.parent().get('id') || root.get('id')
      }
    }))
  })
    .on('close', () => {
      if (['connecting', 'connected'].indexOf(server.get('status').compute()) > -1) {
        server.set({ status: 'retry', connection: null })
        retry(server)
      }
    })
    .on('error', error => {
      root.emit('error', error)
      connection.destroy()
    })

  connection._port = s.port
  connection._host = s.host

  server.set({
    status: 'connecting',
    connection,
    timeout: setTimeout(() => {
      if (server.get('status').compute() !== 'connecting') {
        return
      }

      connection.destroy()
    }, 3e3)
  })
}

function retry (server) {
  if (server.get('status').compute() !== 'retry') {
    return
  }

  stopTimer(server)

  server.set({ timeout: setTimeout(connect, 2e3, server) })
}
