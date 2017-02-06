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
              context = [ context ]
              client.storeValue({
                bucket,
                key: JSON.stringify(key),
                value: { val, stamp }
              }, error => {
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
        context = context || false
        path = path || []

        const p = this
        const client = p.get('client')
        const bucket = p.get('bucket') || p.get(['root', 'id'])
        const root = p.get('root')
        const key = [context].concat(path)

        return p.get('connected')
          .once(true)
          .then(() => new Promise((resolve, reject) => {
            client.listKeys({ bucket, stream: false }, (error, res) => {
              if (error) {
                return reject(error)
              }

              resolve(res.keys.map(JSON.parse))
            })
          }))
          .then(keys => {
            const strkey = JSON.stringify(key)

            return Promise.all(
              keys
              .filter(k => JSON.stringify(k.slice(0, key.length)) === strkey)
              .map(k => new Promise((resolve, reject) => {
                client.fetchValue({ bucket, key: JSON.stringify(k), convertToJs: true }, (error, res) => {
                  if (error) {
                    return reject(error)
                  }

                  const { val, stamp } = res.values[0].value
                  const parsed = bstamp.parse(stamp)

                  const dbStamp = bstamp.create('db', parsed.src, parsed.val)
                  const cRoot = context === false ? root : root.getContext(context)

                  cRoot.get(k.slice(1), val, dbStamp).set(val, dbStamp)

                  resolve()
                })
              }))
            )
          })
      }
    },
    on: {
      data: {
        remove (val, stamp, t) {
          if (val === null) {
            t.set({ connected: false })
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
