'use strict'

const riak = require('basho-riak-client')
const bstamp = require('brisky-stamp')

exports.props = {
  persistent: {
    type: 'struct',
    props: {
      bucket: true,
      client: true,
      nodes: (s, nodes) => s.set({ client: new riak.Client(
        nodes, error => error ? s.get('root').emit('error', error) : s.set({ connected: true })
      ) })
    },
    connected: false,
    define: {
      save ({ path, val, stamp, context }) {
        const p = this

        p.get('connected')
          .once(true)
          .then(() => {
            const client = p.get('client')
            const bucket = p.get('bucket') || p.get(['root', 'id'])
            const key = [context].concat(path)

            if (val === null) {
              client.deleteValue({ bucket, key: JSON.stringify(key) }, error => {
                if (error) {
                  p.get('root').emit('error', error)
                }
              })
            } else {
              client.storeValue({ bucket, key: JSON.stringify(key), value: { val, stamp } }, error => {
                if (error) {
                  p.get('root').emit('error', error)
                }
              })
            }

            client.storeValue({
              bucket: `${bucket}-timeline`,
              key: JSON.stringify([stamp].concat(key)),
              value: val
            }, error => {
              if (error) {
                p.get('root').emit('error', error)
              }
            })
          })
      },
      load (context, path) {
        /*
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
        */
      }
    },
    on: {
      load ({ context, path, val, stamp }, s, t) {
        var root = t.get('root')
        const parsed = bstamp.parse(stamp)

        stamp = bstamp.create('db', parsed.src, parsed.val)

        if (context !== false) {
          root = root.getContext(context)
        }

        root.get(path, val).set(val)
      },
      data: {
        remove (val, stamp, t) {
          if (val === null) {
            t.get('client').stop(error => {
              if (error) {
                t.get('root').emit('error', error)
              }
            })
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
            t.get(['root', 'persistent']).save({
              path: t.path(),
              val,
              stamp,
              context: t.get('root').contextKey || false
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
