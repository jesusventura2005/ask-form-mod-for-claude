'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { claudeCall, quoteCmd } = require('../lib/install')

test('quoteCmd leaves simple args untouched', () => {
  assert.equal(quoteCmd('plugin'), 'plugin')
  assert.equal(quoteCmd('--scope'), '--scope')
  assert.equal(quoteCmd('ask-form@ask-form-local'), 'ask-form@ask-form-local')
  assert.equal(quoteCmd('enforceForm=true'), 'enforceForm=true')
})

test('quoteCmd quotes args with spaces', () => {
  assert.equal(quoteCmd('C:\\Users\\Jesus Ventura\\.claude\\ask-form'), '"C:\\Users\\Jesus Ventura\\.claude\\ask-form"')
})

test('quoteCmd doubles embedded quotes', () => {
  assert.equal(quoteCmd('say "hi"'), '"say ""hi"""')
})

test('quoteCmd quotes cmd.exe metacharacters', () => {
  assert.equal(quoteCmd('a&b'), '"a&b"')
  assert.equal(quoteCmd('a|b'), '"a|b"')
})

test('claudeCall spawns claude directly off Windows', () => {
  for (const platform of ['darwin', 'linux']) {
    const call = claudeCall(['--version'], platform)
    assert.equal(call.command, 'claude')
    assert.deepEqual(call.args, ['--version'])
    assert.equal(call.shell, false)
  }
})

test('claudeCall builds one quoted command line on Windows', () => {
  const call = claudeCall(['plugin', 'marketplace', 'add', 'C:\\Users\\Jesus Ventura\\.claude\\ask-form'], 'win32')
  assert.equal(call.command, 'claude plugin marketplace add "C:\\Users\\Jesus Ventura\\.claude\\ask-form"')
  assert.deepEqual(call.args, [])
  assert.equal(call.shell, true)
})

test('claudeCall defaults to the current platform', () => {
  assert.equal(claudeCall(['--version']).shell, process.platform === 'win32')
})
