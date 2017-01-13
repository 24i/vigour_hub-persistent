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

  if (queue.locked) {
    return debounceWrite(name)
  }

  if (!queue.list.length) {
    return
  }

  queue.locked = true
  const list = queue.list.splice(0)

  return getDb(name)
    .then(db => batchWrite(db, list))
    .then(close)
    .then(() => {
      queue.locked = false
    })
    .catch(error => {
      console.log(error)
      queue.list = list.concat(queue)
      queue.locked = false
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
  // TODO: eliminate previous operations for same key
  queue.push(operation)
}

exports.save = (id, { context, path, val, stamp }) => {
  const tlid = `${id}-timeline`

  ;[id, tlid].forEach(name => {
    if (!queues[name]) {
      queues[name] = { locked: false, list: [], timeout: false }
    }
  })

  const key = [context].concat(path)

  const operation = Object.assign(
    { type: val === null ? 'del' : 'put', key },
    val === null ? {} : { value: { val, stamp } }
  )

  addOptimized(queues[id].list, operation)

  queues[tlid].list.push({
    type: 'put', key: [stamp].concat(key), value: val
  })

  return Promise.all(
    [id, tlid].map(name => {
      const queue = queues[name]
      if (queue.list.length > 2) {
        return writeQueue(name)
      } else if (queue.list.length) {
        return debounceWrite(name)
      }
    })
  )
}

const transform = path => {
  return new Transform({
    objectMode: true,
    transform (item, enc, cb) {
      cb(
        null,
        JSON.stringify(item.key.slice(0, path.length)) === JSON.stringify(path)
          ? Object.assign({context: item.key.shift(), path: item.key}, item.value)
          : null
      )
    }
  })
}

const load = (id, { context, path }) => {
  const queue = queues[id]

  if (queue.locked) {
    return (new Promise(resolve => setImmediate(resolve)))
      .then(load.bind(null, id, { context, path }))
  }

  queue.locked = true
  path = [context].concat(path || [])

  return getDb(id)
    .then(db => {
      const read = db.createReadStream()
        .on('close', () => {
          close(db).catch(error => console.log(error))
          queue.locked = false
        })

      return read.pipe(transform(path))
    })
}
exports.load = load
