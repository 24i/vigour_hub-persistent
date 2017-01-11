'use strict'

const net = require('net')
const JSONStream = require('JSONStream')
// const bstamp = require('brisky-stamp')

exports.props = {
  persistent: {
    type: 'struct',
    define: {
      command (action, payload) {
        const server = this.get('server')

        server.get('status')
          .once('connected')
          .then(() => {
            server.get('connection')
              .write(JSON.stringify({ action, payload }))
          })
      },
      load (context, path) {
        this.command('load', { context, path })
      }
    },
    server: {
      props: {
        connection: true,
        timeout: true,
        default: {
          on (val, stamp, t) {
            if (['port', 'host'].indexOf(t.key) < 0) {
              return
            }

            if (val === null) {
              disconnect(t.parent())
            } else {
              tryConnect(t.parent())
            }
          }
        }
      },
      status: 'idle',
      on: {
        load (data) {

        }
      }
    }
  },
  default: {
    on: {
      data: {
        persistent (val, stamp, t) {
          if (val.val) {
            val = val.val
          }

          if (val.constructor === Object) {
            return
          }

          t.get(['root', 'persistent']).command('save', {
            path: t.path(),
            val,
            stamp,
            context: t.get(['root']).contextKey || ''
          })
        }
      }
    },
    props: {
      default: 'self'
    }
  }
}

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
    parser.on('data', server.emit.bind(server, 'load'))

    connection.write(JSON.stringify({
      action: 'login',
      payload: {
        id: root.get('id')
      }
    }))
  })
    .on('close', () => {
      server.set({ status: 'retry', connection: null })
      retry(server)
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
