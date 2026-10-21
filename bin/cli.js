#!/usr/bin/env node
'use strict'

const readline = require('node:readline')
const { HELP, install, parseArgs, status, uninstall } = require('../lib/install')

function prompter() {
  if (!process.stdin.isTTY) return undefined
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question, parse) => new Promise(resolve => rl.question(question, answer => resolve(parse(answer.trim()))))

  return { ask, close: () => rl.close() }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return console.log(HELP)
  if (opts.command === 'status') return status()
  const p = prompter()
  try {
    await (opts.command === 'uninstall' ? uninstall : install)(opts, { ask: p?.ask })
  } finally {
    p?.close()
  }
}

main().catch(err => {
  console.error(`ask-form: ${err.message}`)
  process.exit(1)
})
