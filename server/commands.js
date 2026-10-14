import * as catalog from './services/catalog.js'
import { pingDatabase } from './db.js'
import { scanners } from './services/scanners.js'

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
  scanner create <name>         Save a scanner configuration
  scanner list                  List scanners
  scanner attach <name> <collection> Attach a collection
  scanner detach <name> <collection> Detach a collection
  scanner start <name>          Build live in-memory registry (no prices)
  scanner sync <name>           Refresh registry from MongoDB
  scanner status <name>         Show registry / subscriptions
  scanner stop <name>           Release registry references
  scanner kill <name>           Same as stop for now
  exit                          Exit the CLI

Examples:
  asset add BTC
  collection create watchlist
  collection add watchlist BTC
  collection show watchlist`

export async function execute(input, services = { catalog, pingDatabase, scanners }) {
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

  if (verb === 'scanner') {
    const s = services.scanners
    if (action === 'create') {
      if (args.length !== 1) usage('scanner create <name>')
      const result = await s.create(args[0])
      return success(result.created ? `Created scanner ${result.name}.` : `Scanner ${result.name} already exists.`)
    }
    if (action === 'list') {
      if (args.length) usage('scanner list')
      const names = await s.list()
      return success(names.length ? names.map((n, i) => `${i + 1}. ${n}`).join('\n') : 'No scanners yet.')
    }
    if (action === 'attach') {
      if (args.length !== 2) usage('scanner attach <name> <collection>')
      const result = await s.attach(args[0], args[1])
      return success(result.attached
        ? `Attached ${result.collection} to ${result.name}. Run scanner start/sync to refresh.`
        : `${result.collection} is already attached to ${result.name}.`)
    }
    if (action === 'detach') {
      if (args.length !== 2) usage('scanner detach <name> <collection>')
      const result = await s.detach(args[0], args[1])
      return success(result.detached
        ? `Detached ${result.collection} from ${result.name}.`
        : `${result.collection} isn't attached to ${result.name}.`)
    }
    if (action === 'start' || action === 'sync') {
      if (args.length !== 1) usage(`scanner ${action} <name>`)
      const result = await s[action](args[0])
      return success(`${result.name}: registry active, ${result.subscriptions} subscription(s), ${result.symbols.length} distinct symbol(s) (${result.symbols.join(', ') || 'none'}). No live price feed yet.`)
    }
    if (action === 'status') {
      if (args.length !== 1) usage('scanner status <name>')
      const result = await s.status(args[0])
      return success(`${result.name}: ${result.running ? 'registry active' : 'stopped'}; collections: ${result.collections.join(', ') || 'none'}; active symbols: ${result.symbols.join(', ') || 'none'}; shared registry total: ${result.totalUniqueAssets}. No price scanning yet.`)
    }
    if (action === 'stop' || action === 'kill') {
      if (args.length !== 1) usage(`scanner ${action} <name>`)
      const result = await s.stop(args[0])
      return success(result.stopped ? `${result.name}: registry stopped.` : `${result.name}: already stopped.`)
    }
  }

  return success('Unknown command. Type help to see available commands.')
}
