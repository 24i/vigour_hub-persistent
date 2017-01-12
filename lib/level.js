'use strict'

const level = require('level')
const Transform = require('stream').Transform

const options = {
  keyEncoding: 'json',
  valueEncoding: 'json'
}

const queues = {}
const writing = {}

const getDb = name => new Promise((resolve, reject) => level(
  `./${name}`, options, (error, db) => error ? reject(error) : resolve(db)
))

const batchWrite = (db, ops) => new Promise((resolve, reject) => db.batch(
  ops, error => error ? reject(error) : resolve(db)
))

const close = db => new Promise((resolve, reject) => db.close(
  error => error ? reject(error) : resolve()
))

const write = (name, ops) => getDb(name)
  .then(db => batchWrite(db, ops))
  .then(close)

const addOptimized = (queue, operation) => {
  queue.push(operation)
}

exports.save = (id, { context, path, val, stamp }) => {
  const tlid = `${id}-timeline`

  if (!queues[id]) {
    queues[id] = []
  }

  if (!queues[tlid]) {
    queues[tlid] = []
  }

  const key = [context].concat(path)

  const operation = Object.assign(
    { type: val === null ? 'del' : 'put', key },
    val === null ? {} : { val: { val, stamp } }
  )

  addOptimized(queues[id], operation)

  queues[tlid].push({
    type: 'put', key: [stamp].concat(key), val
  })

  return Promise.all([id, tlid]
    .filter(name => !writing[name] && queues[name].length > 2)
    .map(name => {
      writing[name] = true
      const queue = queues[name].splice(0, 50)
      return write(name, queue)
        .then(() => {
          writing[name] = false
        })
        .catch(error => {
          console.log(error)
          queues[name] = queue.concat(queues[name])
          writing[name] = false
        })
    })
  )
}

const transform = path => {
  return new Transform({
    transform (chunk, enc, cb) {
      console.log(chunk)
      console.log(chunk.key, chunk.val)
      cb(null, chunk)
    }
  })
}

exports.load = (id, { context, path }) => {
  const key = [context].concat(path)

  return getDb(id)
    .then(db => new Promise((resolve, reject) => db.createReadStream().pipe(transform(key))))
}
