import { connectDatabase } from '../db.js'
import Asset from '../models/Asset.js'
import Collection from '../models/Collection.js'
import Membership from '../models/Membership.js'
import Provider from '../models/Provider.js'
import Exchange from '../models/Exchange.js'
import EventRule from '../models/EventRule.js'
import Process from '../models/Process.js'
import * as catalog from './catalog.js'
import { scanners } from './scanners.js'
import { eventEngine } from './EventEngine.js'

// Explicit, idempotent seed. Never runs at server startup.
// Sample metadata is illustrative, not verified market-provider discovery.
const demoAssets = [
  ['BTC', 'Bitcoin', 'crypto', 'BTC-USD', 'USD', 'coinbase', 'coinbase'],
  ['ETH', 'Ethereum', 'crypto', 'ETH-USD', 'USD', 'coinbase', 'coinbase'],
  ['SOL', 'Solana', 'crypto', 'SOL-USDT', 'USDT', 'okx', 'okx'],
  ['TSLA', 'Tesla', 'stock', 'TSLA', 'USD', 'alpaca', 'nasdaq'],
  ['NVDA', 'NVIDIA', 'stock', 'NVDA', 'USD', 'alpaca', 'nasdaq'],
]
export async function seedDemo() {
  await connectDatabase()
  for (const [symbol, name, assetClass, marketSymbol, quote, provider, exchange] of demoAssets) {
    await catalog.addAsset(symbol)
    // Never replace genuine catalog metadata just to set up an example.
    const existing = await Asset.findOne({ symbol })
    const changes = {}
    if (!existing.name) changes.name = name
    if (!existing.assetClass || existing.assetClass === 'unknown') changes.assetClass = assetClass
    if (!existing.markets?.length) {
      changes.markets = [{ symbol: marketSymbol, base: symbol, quote, provider, exchange, activityRank: 1, verified: false }]
      if (symbol === 'BTC') changes.markets.push({ symbol: 'BTC-USDT', base: 'BTC', quote: 'USDT', provider: 'okx', exchange: 'okx', activityRank: 2, verified: false })
      if (symbol === 'SOL') changes.markets.unshift({ symbol: 'SOL-USD', base: 'SOL', quote: 'USD', provider: 'coinbase', exchange: 'coinbase', activityRank: 2, verified: false })
    }
    if (Object.keys(changes).length) await Asset.updateOne({ _id: existing._id }, { $set: changes })
  }
  for (const provider of [
    { slug: 'coinbase', name: 'Coinbase', assetClasses: ['crypto'], capabilities: ['websocket', 'ticker'], settings: { enabled: true, priority: 1 }, isDemo: true },
    { slug: 'alpaca', name: 'Alpaca', assetClasses: ['stock'], capabilities: ['websocket', 'rest', 'iex'], settings: { enabled: false, priority: 2 }, isDemo: true },
    { slug: 'okx', name: 'OKX', assetClasses: ['crypto'], capabilities: ['websocket', 'rest'], settings: { enabled: false, priority: 3 }, isDemo: true },
  ]) await Provider.updateOne({ slug: provider.slug }, { $setOnInsert: provider }, { upsert: true })
  for (const exchange of [
    { slug: 'coinbase', name: 'Coinbase Exchange', assetClasses: ['crypto'], isDemo: true },
    { slug: 'okx', name: 'OKX', assetClasses: ['crypto'], isDemo: true },
    { slug: 'nasdaq', name: 'Nasdaq', assetClasses: ['stock'], timezone: 'America/New_York', isDemo: true },
  ]) await Exchange.updateOne({ slug: exchange.slug }, { $setOnInsert: exchange }, { upsert: true })
  await catalog.createCollection('demo-watchlist')
  for (const [symbol] of demoAssets) await catalog.addMember('demo-watchlist', symbol)
  await catalog.createCollection('demo-usdt')
  for (const symbol of ['BTC', 'SOL']) await catalog.addMember('demo-usdt', symbol)
  // Configure preferences only for new, untouched memberships.
  const demoLists = {
    'demo-watchlist': {
      BTC: ['coinbase', 'BTC-USD'], ETH: ['coinbase', 'ETH-USD'], SOL: ['coinbase', 'SOL-USD'],
      TSLA: ['alpaca', 'TSLA'], NVDA: ['alpaca', 'NVDA'],
    },
    'demo-usdt': { BTC: ['okx', 'BTC-USDT'], SOL: ['okx', 'SOL-USDT'] },
  }
  for (const [listName, preferenceMap] of Object.entries(demoLists)) {
    const list = await Collection.findOne({ name: listName })
    for (const [symbol, [provider, marketSymbol]] of Object.entries(preferenceMap)) {
      const asset = await Asset.findOne({ symbol })
      await Membership.updateOne({ collection: list._id, asset: asset._id,
        $or: [{ 'preferences.provider': '' }, { 'preferences.provider': { $exists: false } }] },
        { $set: { 'preferences.provider': provider, 'preferences.marketSymbol': marketSymbol } })
    }
  }
  await scanners.create('demo-momentum')
  await scanners.attach('demo-momentum', 'demo-watchlist')
  await Process.updateOne({ name: 'demo-momentum' }, { $set: { config: { session: 'extended', mode: 'manual' } } })
  await Process.updateOne({ name: 'demo-discovery' },
    { $setOnInsert: { name: 'demo-discovery', kind: 'discovery', enabled: false, intervalSeconds: 300, config: { throttled: true } } },
    { upsert: true })
  await Process.updateOne({ name: 'demo-snapshots' },
    { $setOnInsert: { name: 'demo-snapshots', kind: 'snapshot', enabled: false, intervalSeconds: 300, config: { target: 'app.market-data', history: false } } },
    { upsert: true })
  await EventRule.updateOne({ name: 'demo-btc-5pct' }, { $setOnInsert: {
    name: 'demo-btc-5pct', target: { scope: 'global' }, trigger: 'market.momentum.detected',
    conditions: [{ path: 'data.symbol', operator: 'eq', value: 'BTC' }, { path: 'data.changePct', operator: 'gte', value: 5 }],
    actions: [{ type: 'snapshot.capture', config: { type: 'market-event' } },
      { type: 'alert.record', config: { message: 'BTC +5%: captured market snapshot' } }],
    enabled: true, isDemo: true,
  } }, { upsert: true })
  await EventRule.updateOne({ name: 'demo-on-snapshot' }, { $setOnInsert: {
    name: 'demo-on-snapshot', target: { scope: 'global' }, trigger: 'snapshot.created',
    conditions: [{ path: 'data.snapshotType', operator: 'eq', value: 'market-event' }],
    actions: [{ type: 'alert.record', config: { message: 'An event snapshot was captured' } }],
    enabled: false, isDemo: true,
  } }, { upsert: true })
  eventEngine.invalidate()
  return { assets: demoAssets.length, collection: 'demo-watchlist', scanner: 'demo-momentum', rules: 2 }
}

export async function triggerDemoEvent() {
  // A simulated event for checking configured rules, NEVER a real market signal.
  const event = { type: 'market.momentum.detected',
    source: { scope: 'asset', id: 'BTC' },
    data: { symbol: 'BTC', changePct: 5.2, interval: '5m' }, demo: true }
  const results = await eventEngine.evaluate(event)
  return { event, results }
}
