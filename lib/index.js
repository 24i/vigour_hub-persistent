'use strict'

const bstamp = require('brisky-stamp')

const client = require('./client')

exports.props = {
  persistent: {
    type: 'struct',
    props: {
      id: true
    },
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
        context = context || false
        path = path || []
        const server = this.get('server')

        return new Promise(resolve => {
          server.on('loaded', ({ context: c, path: p }) => {
            if (c === context && JSON.stringify(p) === JSON.stringify(path)) {
              resolve()
            }
          })

          this.command('load', { context, path })
        })
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
              client.disconnect(t.parent())
            } else {
              client.tryConnect(t.parent())
            }
          }
        }
      },
      status: 'idle',
      on: {
        load ({ context, path, val, stamp }, s, t) {
          var root = t.get('root')
          const parsed = bstamp.parse(stamp)

          stamp = bstamp.create('db', parsed.src, parsed.val)

          if (context !== false) {
            root = root.getContext(context)
          }

          root.get(path, val).set(val)
        }
      }
    },
    on: {
      data: {
        remove (val, stamp, t) {
          if (val === null) {
            client.disconnect(t.get('server'))
          }
        }
      }
    }
  },
  default: {
    on: {
      data: {
        persistent (val, stamp, t) {
          if (val && val.val) {
            val = val.val
          }

          if (val && val.constructor === Object) {
            return
          }

          const parsed = bstamp.parse(stamp)

          if (parsed.type === 'db') {
            return
          }

          if (t.get(['root', 'persistent'])) {
            t.get(['root', 'persistent']).command('save', {
              path: t.path(),
              val,
              stamp,
              context: t.get(['root']).contextKey || false
            })
          }
        }
      }
    },
    props: {
      default: 'self'
    }
  }
}
