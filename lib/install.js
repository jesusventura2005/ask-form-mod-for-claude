'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const PLUGIN = 'ask-form'
const MARKETPLACE = 'ask-form-local'
const ID = `${PLUGIN}@${MARKETPLACE}`
const SCOPES = ['user', 'project', 'local']
const MOD_DIR = path.join(__dirname, '..', 'mod')

const HELP = `ask-form-mod-for-claude: Claude's questions as a form, for Claude Code.

Usage:
  npx ask-form-mod-for-claude [install] [options]
  npx ask-form-mod-for-claude uninstall [options]
  npx ask-form-mod-for-claude status

Options:
  --enforce-forms       Tell Claude to ask everything through the form (default)
  --no-enforce-forms    Install the form only; Claude may still ask in plain text
  --scope <scope>       user (default), project or local
  --dir <path>          Where the mod's files live (default: ~/.claude/ask-form)
  -y, --yes             Do not ask questions; use the defaults for what is not given
  -h, --help            Show this help
`

function parseArgs(argv) {
  const opts = { command: 'install', enforce: undefined, scope: undefined, dir: undefined, yes: false, help: false }
  const rest = [...argv]
  if (rest[0] && !rest[0].startsWith('-')) opts.command = rest.shift()
  while (rest.length > 0) {
    const arg = rest.shift()
    if (arg === '--enforce-forms') opts.enforce = true
    else if (arg === '--no-enforce-forms') opts.enforce = false
    else if (arg === '-y' || arg === '--yes') opts.yes = true
    else if (arg === '-h' || arg === '--help') opts.help = true
    else if (arg === '--scope' || arg === '--dir') {
      const value = rest.shift()
      if (value === undefined || value.startsWith('-')) throw new Error(`${arg} needs a value`)
      opts[arg.slice(2)] = value
    } else throw new Error(`Unknown option: ${arg}`)
  }
  if (!['install', 'uninstall', 'status'].includes(opts.command)) throw new Error(`Unknown command: ${opts.command}`)
  if (opts.scope !== undefined && !SCOPES.includes(opts.scope)) throw new Error(`--scope must be one of: ${SCOPES.join(', ')}`)

  return opts
}

const defaultDir = () => path.join(os.homedir(), '.claude', 'ask-form')

function isOurs(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).name === PLUGIN
  } catch {
    return false
  }
}

// Replaces the folder with the packaged mod; refuses a folder that is not this mod's.
function copyMod(dest, source = MOD_DIR) {
  if (fs.existsSync(dest) && !isOurs(dest)) {
    throw new Error(`${dest} exists and is not this mod. Pick another folder with --dir.`)
  }
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(source, dest, { recursive: true })
}

// cmd.exe metacharacters force quoting; embedded quotes are doubled.
const quoteCmd = arg => (/[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg)

// How to invoke `claude` per platform. On Windows the CLI may be claude.cmd
// (npm), which CreateProcess cannot run directly, so it goes through cmd.exe
// as one quoted command line: keeps paths with spaces working.
const claudeCall = (args, platform = process.platform) =>
  platform === 'win32'
    ? { command: ['claude', ...args.map(quoteCmd)].join(' '), args: [], shell: true }
    : { command: 'claude', args, shell: false }

function claude(args) {
  const call = claudeCall(args)
  const r = spawnSync(call.command, call.args, { shell: call.shell, encoding: 'utf8' })

  return { status: r.error ? 127 : r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const isInstalled = out => out.includes(ID)

async function resolve(opts, ask) {
  const interactive = !opts.yes && ask !== undefined
  let enforce = opts.enforce
  let scope = opts.scope
  if (enforce === undefined) {
    enforce = interactive ? await ask('Make Claude ask everything through the form? [Y/n] ', v => v === '' || /^y/i.test(v)) : true
  }
  if (scope === undefined) {
    scope = interactive ? await ask(`Install for (${SCOPES.join('/')}) [user]: `, v => (SCOPES.includes(v) ? v : 'user')) : 'user'
  }

  return { enforce, scope }
}

async function install(opts, { run = claude, ask, log = console.log } = {}) {
  if (run(['--version']).status !== 0) {
    throw new Error('The `claude` command was not found. Install Claude Code first: https://claude.com/claude-code')
  }
  const dir = path.resolve(opts.dir ?? defaultDir())
  const { enforce, scope } = await resolve(opts, ask)

  copyMod(dir)
  log(`Copied the mod to ${dir}`)
  if (isInstalled(run(['plugin', 'list']).out)) {
    run(['plugin', 'uninstall', ID])
    log('Replaced the previous install')
  }
  const added = run(['plugin', 'marketplace', 'add', dir])
  if (added.status !== 0 && !/already/i.test(added.out)) throw new Error(`marketplace add failed:\n${added.out.trim()}`)
  const done = run(['plugin', 'install', ID, '--scope', scope, '--config', `enforceForm=${enforce}`])
  if (done.status !== 0) throw new Error(`install failed:\n${done.out.trim()}`)
  log(`Installed ${ID} (scope: ${scope}, enforce forms: ${enforce}).`)
  log('Open a new Claude Code session, or run /reload-plugins in the current one.')
  log('Do not move or delete ' + dir + ': Claude reads the mod from there.')
}

async function uninstall(opts, { run = claude, ask, log = console.log } = {}) {
  const dir = path.resolve(opts.dir ?? defaultDir())
  const removed = run(['plugin', 'uninstall', ID])
  log(removed.status === 0 ? `Uninstalled ${ID}.` : `Not installed (${ID}).`)
  run(['plugin', 'marketplace', 'remove', MARKETPLACE])
  if (isOurs(dir)) {
    const ok = opts.yes || ask === undefined ? true : await ask(`Delete ${dir}? [Y/n] `, v => v === '' || /^y/i.test(v))
    if (ok) {
      fs.rmSync(dir, { recursive: true, force: true })
      log(`Deleted ${dir}`)
    }
  }
}

function status({ run = claude, log = console.log } = {}) {
  const { out } = run(['plugin', 'list'])
  log(isInstalled(out) ? `${ID} is installed.` : `${ID} is not installed.`)
}

module.exports = { ID, MARKETPLACE, PLUGIN, SCOPES, parseArgs, copyMod, isOurs, install, uninstall, status, HELP, defaultDir, quoteCmd, claudeCall }
