import * as catalog from './services/catalog.js'
import { pingDatabase } from './db.js'
import { scanners } from './services/scanners.js'
import { normalizeSymbol } from './lib/validation.js'

// One command interpreter shared by HTTP requests and CLI entry points.
export const HELP = `Trading Ecosystem commands

  help                             Show commands
  status                           Ping MongoDB

  asset add BTC, TSLA               Add one or more symbols
  asset list                        List symbols
  asset delete BTC                  Delete asset and its memberships

  collection create watchlist       Create a list
  collection list                   List all lists
  collection show watchlist         Show tickers
  collection add watchlist BTC,TSLA Add symbols (creates missing assets)
  collection remove watchlist BTC   Remove symbols from list
  collection rename old new        Rename list
  collection delete watchlist       Delete list and its attachments

  scanner create momentum          Create scanner
  scanner list                     List scanners
  scanner show momentum            Show scanner configuration
  scanner rename momentum newname  Rename scanner
  scanner delete momentum          Delete scanner and attachments
  scanner attach momentum watchlist
  scanner detach momentum watchlist
  scanner start momentum           Start in-memory registry (no live prices)
  scanner sync momentum            Rebuild running registry
  scanner status momentum
  scanner stop momentum
  scanner kill momentum            Same as stop for now

  exit                             Leave interactive CLI

Names use letters, numbers, underscores and hyphens without spaces.
You can separate ticker symbols using commas, spaces, or both.`

const usage = syntax => { throw new Error(`Usage: ${syntax}`) }
const success = (...lines) => ({ lines, keepRunning: true })

function symbolsFrom(args, command) {
  const raw = args.join(' ').split(/[\s,]+/).filter(Boolean)
  if (raw.length === 0) usage(command)
  if (raw.length > 50) throw new Error('Maximum 50 symbols per command.')
  // Validate every token first to avoid partial writes for invalid symbols.
  return [...new Set(raw.map(normalizeSymbol))]
}

function requireArgs(args, number, command) {
  if (args.length !== number) usage(command)
}

const lineList = (values, empty) => values.length
  ? values.map((value, i) => `${i + 1}. ${value}`).join('\n')
  : empty

export async function execute(input, services = { catalog, pingDatabase, scanners }) {
  if (typeof input !== 'string' || input.length > 1000) throw new Error('Command must be text under 1000 characters.')
  const parts = input.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return success()
  const [verb, action, ...args] = parts

  if ((verb === 'exit' || verb === 'quit') && !action) return { lines: [], keepRunning: false }
  if (verb === 'help' && !action) return success(HELP)
  if (verb === 'status' && !action) {
    await services.pingDatabase()
    return success('MongoDB: connected')
  }

  const c = services.catalog
  const s = services.scanners

  if (verb === 'asset') {
    if (action === 'add') {
      const symbols = symbolsFrom(args, 'asset add <symbols>')
      const results = []
      for (const symbol of symbols) results.push(await c.addAsset(symbol))
      if (results.length === 1) return success(results[0].created ? `Added ${symbols[0]}.` : `${symbols[0]} is already saved.`)
      return success(`Added ${results.filter(item => item.created).length} of ${results.length}: ${symbols.join(', ')}.`)
    }
    if (action === 'list') {
      requireArgs(args, 0, 'asset list')
      return success(lineList(await c.listAssets(), 'No assets yet. Try: asset add BTC'))
    }
    if (action === 'delete') {
      const symbols = symbolsFrom(args, 'asset delete <symbols>')
      const results = []
      for (const symbol of symbols) results.push(await c.deleteAsset(symbol))
      await s?.refreshActive?.()
      if (results.length === 1) return success(results[0].deleted ? `Deleted asset ${symbols[0]}.` : `Asset ${symbols[0]} not found.`)
      return success(`Deleted ${results.filter(item => item.deleted).length} of ${results.length} assets.`)
    }
  }

  if (verb === 'collection') {
    if (action === 'create') {
      requireArgs(args, 1, 'collection create <name>')
      const result = await c.createCollection(args[0])
      return success(result.created ? `Created collection ${result.name}.` : `Collection ${result.name} already exists.`)
    }
    if (action === 'list') {
      requireArgs(args, 0, 'collection list')
      return success(lineList(await c.listCollections(), 'No collections yet.'))
    }
    if (action === 'show') {
      requireArgs(args, 1, 'collection show <name>')
      const result = await c.showCollection(args[0])
      return success(result.symbols.length ? `${result.name}: ${result.symbols.join(', ')}` : `${result.name}: (empty)`)
    }
    if (action === 'add') {
      if (args.length < 2) usage('collection add <name> <symbols>')
      const symbols = symbolsFrom(args.slice(1), 'collection add <name> <symbols>')
      // Check the collection before creating assets, so bad list names cause no writes.
      await c.showCollection(args[0])
      const results = []
      for (const symbol of symbols) {
        await c.addAsset(symbol)
        results.push(await c.addMember(args[0], symbol))
      }
      await s?.refreshActive?.()
      if (results.length === 1) {
        const item = results[0]
        return success(item.added ? `Added ${item.symbol} to ${item.collection}.` : `${item.symbol} is already in ${item.collection}.`)
      }
      return success(`Added ${results.filter(item => item.added).length} of ${results.length} symbols to ${args[0]}: ${symbols.join(', ')}.`)
    }
    if (action === 'remove') {
      if (args.length < 2) usage('collection remove <name> <symbols>')
      const symbols = symbolsFrom(args.slice(1), 'collection remove <name> <symbols>')
      const results = []
      for (const symbol of symbols) results.push(await c.removeMember(args[0], symbol))
      await s?.refreshActive?.()
      if (results.length === 1) {
        const item = results[0]
        return success(item.removed ? `Removed ${item.symbol} from ${item.collection}.` : `${item.symbol} wasn't in ${item.collection}.`)
      }
      return success(`Removed ${results.filter(item => item.removed).length} of ${results.length} symbols from ${args[0]}.`)
    }
    if (action === 'rename') {
      requireArgs(args, 2, 'collection rename <old> <new>')
      const result = await c.renameCollection(args[0], args[1])
      return success(result.renamed ? `Renamed collection ${result.name} to ${result.next}.` : `Collection is already named ${result.name}.`)
    }
    if (action === 'delete') {
      requireArgs(args, 1, 'collection delete <name>')
      const result = await c.deleteCollection(args[0])
      await s?.refreshActive?.()
      return success(result.deleted ? `Deleted collection ${result.name} and its attachments.` : `Collection ${result.name} not found.`)
    }
  }

  if (verb === 'scanner') {
    if (action === 'create') {
      requireArgs(args, 1, 'scanner create <name>')
      const result = await s.create(args[0])
      return success(result.created ? `Created scanner ${result.name}.` : `Scanner ${result.name} already exists.`)
    }
    if (action === 'list') {
      requireArgs(args, 0, 'scanner list')
      return success(lineList(await s.list(), 'No scanners yet.'))
    }
    if (action === 'show' || action === 'status') {
      requireArgs(args, 1, `scanner ${action} <name>`)
      const result = await s.status(args[0])
      return success(`${result.name}: ${result.running ? 'registry active' : 'stopped'}; collections: ${result.collections.join(', ') || 'none'}; active symbols: ${result.symbols.join(', ') || 'none'}; shared registry total: ${result.totalUniqueAssets}. No price scanning yet.`)
    }
    if (action === 'rename') {
      requireArgs(args, 2, 'scanner rename <old> <new>')
      const result = await s.rename(args[0], args[1])
      return success(result.renamed ? `Renamed scanner ${result.name} to ${result.next}.` : `Scanner is already named ${result.name}.`)
    }
    if (action === 'delete') {
      requireArgs(args, 1, 'scanner delete <name>')
      const result = await s.delete(args[0])
      return success(`Deleted scanner ${result.name} and its subscriptions.`)
    }
    if (action === 'attach') {
      requireArgs(args, 2, 'scanner attach <name> <collection>')
      const result = await s.attach(args[0], args[1])
      await s.refreshActive?.()
      return success(result.attached ? `Attached ${result.collection} to ${result.name}.` : `${result.collection} is already attached to ${result.name}.`)
    }
    if (action === 'detach') {
      requireArgs(args, 2, 'scanner detach <name> <collection>')
      const result = await s.detach(args[0], args[1])
      await s.refreshActive?.()
      return success(result.detached ? `Detached ${result.collection} from ${result.name}.` : `${result.collection} isn't attached to ${result.name}.`)
    }
    if (action === 'start' || action === 'sync') {
      requireArgs(args, 1, `scanner ${action} <name>`)
      const result = await s[action](args[0])
      return success(`${result.name}: registry active, ${result.subscriptions} subscription(s), ${result.symbols.length} distinct symbol(s) (${result.symbols.join(', ') || 'none'}). No live price feed yet.`)
    }
    if (action === 'stop' || action === 'kill') {
      requireArgs(args, 1, `scanner ${action} <name>`)
      const result = await s.stop(args[0])
      return success(result.stopped ? `${result.name}: registry stopped.` : `${result.name}: already stopped.`)
    }
  }

  return success('Unknown command. Type help to see available commands.')
}
