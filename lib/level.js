'use strict'

const level = require('level')
const Transform = require('stream').Transform

const options = {
  keyEncoding: 'json',
  valueEncoding: 'json'
}

const queues = {}

const getDb = name => new Promise((resolve, reject) => level(
  `./${name}`, options, (error, db) => error ? reject(error) : resolve(db)
))

const batchWrite = (db, ops) => new Promise((resolve, reject) => db.batch(
  ops, error => error ? reject(error) : resolve(db)
))

const close = db => new Promise((resolve, reject) => db.close(
  error => error ? reject(error) : resolve()
))

const writeQueue = name => {
  const queue = queues[name]

  if (queue.timeout) {
    clearTimeout(queue.timeout)
  }

  if (queue.writing) {
    return debounceWrite(name)
  }

  if (!queue.list.length) {
    return
  }

  queue.writing = true
  const list = queue.list.splice(0)

  return getDb(name)
    .then(db => batchWrite(db, list))
    .then(close)
    .then(() => {
      queue.writing = false
    })
    .catch(error => {
      console.log(error)
      queue.list = list.concat(queue)
      queue.writing = false
    })
}

const debounceWrite = name => {
  const queue = queues[name]

  if (queue.timeout) {
    clearTimeout(queue.timeout)
  }

  queue.timeout = setTimeout(writeQueue.bind(null, name), 300)
}

const addOptimized = (queue, operation) => {
  queue.push(operation)
}

exports.save = (id, { context, path, val, stamp }) => {
  const tlid = `${id}-timeline`

  if (!queues[id]) {
    queues[id] = { writing: false, list: [], timeout: false }
  }

  if (!queues[tlid]) {
    queues[tlid] = { writing: false, list: [], timeout: false }
  }

  const key = [context].concat(path)

  const operation = Object.assign(
    { type: val === null ? 'del' : 'put', key },
    val === null ? {} : { val: { val, stamp } }
  )

  addOptimized(queues[id].list, operation)

  queues[tlid].list.push({
    type: 'put', key: [stamp].concat(key), val
  })

  return Promise.all(
    [id, tlid].map(name => {
      const queue = queues[name]
      if (!queue.writing && queue.list.length > 2) {
        return writeQueue(name)
      } else if (queue.list.length) {
        return debounceWrite(name)
      }
    })
  )
}

const transform = path => {
  return new Transform({
    transform (chunk, enc, cb) {
      console.log(chunk)
      cb(null, JSON.stringify(chunk.slice(0, path.length)) === JSON.stringify(path) ? chunk : null)
    }
  })
}

exports.load = (id, { context, path }) => {
  path = path || []
  const key = [context].concat(path)

  return getDb(id)
    .then(db => new Promise((resolve, reject) => db.createReadStream().pipe(transform(key))))
}
