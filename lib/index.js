'use strict'

const hub = require('hub.js')

exports.props = {
  persistent: {
    define: {
      load (context, path) {

      }
    },
    server: {
      on (val, stamp, t) {
        t.parent().set({ conn: hub({ url: val }) })
      }
    },
    conn: true
  },
  default: {
    on: {
      data: {
        persistent (val, stamp, t) {
          console.log('data updated')
        }
      }
    },
    props: {
      default: 'self'
    }
  }
}
