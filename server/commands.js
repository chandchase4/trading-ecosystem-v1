import * as catalog from './services/catalog.js'
import { pingDatabase } from './db.js'

export const HELP = `Trading Ecosystem CLI

  help                          Show commands
  status                        Ping MongoDB
  asset add <symbol>            Save an asset
  asset list                    List assets
  collection create <name>      Create a collection
  collection list               List collections
  collection show <name>        Show collection members
  collection add <name> <symbol>   Add an existing asset
  collection remove <name> <symbol> Remove a member
  exit                          Exit the CLI

Examples:
  asset add BTC
  collection create watchlist
  collection add watchlist BTC
  collection show watchlist`

export async function execute(input, services = { catalog, pingDatabase }) {
  const parts = String(input ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { lines: [], keepRunning: true }
  const [verb, action, ...args] = parts

  if ((verb === 'exit' || verb === 'quit') && !action) {
    return { lines: [], keepRunning: false }
  }
  if (verb === 'help' && !action) {
    return { lines: [HELP], keepRunning: true }
  }
  if (verb === 'status' && !action) {
    await services.pingDatabase()
    return { lines: ['MongoDB: connected'], keepRunning: true }
  }

  const usage = (syntax) => { throw new Error(`Usage: ${syntax}`) }
  const success = (...lines) => ({ lines, keepRunning: true })
  const c = services.catalog

  if (verb === 'asset') {
    if (action === 'add') {
      if (args.length !== 1) usage('asset add <symbol>')
      const result = await c.addAsset(args[0])
      return success(result.created ? `Added ${result.symbol}.` : `${result.symbol} is already saved.`)
    }
    if (action === 'list') {
      if (args.length) usage('asset list')
      const symbols = await c.listAssets()
      return success(symbols.length ? symbols.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'No assets yet. Try: asset add BTC')
    }
  }

  if (verb === 'collection') {
    if (action === 'create') {
      if (args.length !== 1) usage('collection create <name>')
      const result = await c.createCollection(args[0])
      return success(result.created ? `Created collection ${result.name}.` : `Collection ${result.name} already exists.`)
    }
    if (action === 'list') {
      if (args.length) usage('collection list')
      const names = await c.listCollections()
      return success(names.length ? names.map((n, i) => `${i + 1}. ${n}`).join('\n') : 'No collections yet.')
    }
    if (action === 'show') {
      if (args.length !== 1) usage('collection show <name>')
      const result = await c.showCollection(args[0])
      return success(result.symbols.length ? `${result.name}: ${result.symbols.join(', ')}` : `${result.name}: (empty)`)
    }
    if (action === 'add') {
      if (args.length !== 2) usage('collection add <name> <symbol>')
      const result = await c.addMember(args[0], args[1])
      return success(result.added ? `Added ${result.symbol} to ${result.collection}.` : `${result.symbol} is already in ${result.collection}.`)
    }
    if (action === 'remove') {
      if (args.length !== 2) usage('collection remove <name> <symbol>')
      const result = await c.removeMember(args[0], args[1])
      return success(result.removed ? `Removed ${result.symbol} from ${result.collection}.` : `${result.symbol} wasn't in ${result.collection}.`)
    }
  }

  return success('Unknown command. Type help to see available commands.')
}
