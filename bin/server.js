#!/usr/bin/env node

'use strict'

const createServer = require('../lib/server')
createServer(process.argv[2] || 1515)
