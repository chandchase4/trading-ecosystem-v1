import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSymbol, AssetRegistry } from '../assetRegistry.js'
import { DataManager } from '../dataManager.js'
import { ScannerEngine } from '../scannerEngine.js'
import { Events } from '../events.js'

test('Asset Registry validates symbols and deduplicates concurrent ingestion', async () => {
  assert.equal(normalizeSymbol(' btc '), 'BTC')
  assert.throws(() => normalizeSymbol('evil<script>'), /Invalid/)
  const records = []
  const registry = new AssetRegistry({
    assetModel: { updateOne: async (query) => { records.push(query.symbol); return { upsertedCount: 1 } } },
    publish: () => {},
  })
  await Promise.all(Array.from({ length: 10 }, () => registry.ensureFromData({
    symbol: 'BTC', provider: 'coinbase', marketSymbol: 'BTC-USD' })))
  assert.deepEqual(records, ['BTC'])
})

test('Data Manager accepts trusted provider updates and emits events to scanners', async () => {
  const messages = []
  const scanned = []
  const dm = new DataManager({
    registry: { ensureFromData: async () => ({ created: false }) },
    engine: { ingest: quote => scanned.push(quote), symbolConsumers: new Map([['BTC', new Set(['scanner-1'])]]) },
    eventBus: { publish: (...args) => messages.push(args) },
  })
  assert.equal(dm.ingest({ symbol: 'BTC', marketSymbol: 'BTC-USD', provider: 'coinbase', price: '100' }), true)
  assert.equal(dm.ingest({ symbol: 'BTC', marketSymbol: 'BTC-USD', provider: 'untrusted', price: '100' }), false)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(messages[0][0], 'market.data.received')
  assert.deepEqual(messages[0][2].scannerIds, ['scanner-1'])
  assert.equal(scanned[0].symbol, 'BTC')
  dm.stop()
})

test('Scanner Engine deduplicates consumers and keeps results scoped per scanner', () => {
  const engine = new ScannerEngine({ publish: () => {} })
  engine.scanners = new Map([['1', { id: '1', name: 'momentum', minChangePct: 5, symbols: new Set(['BTC']), subscriptions: [] }],
    ['2', { id: '2', name: 'breakout', minChangePct: 10, symbols: new Set(['BTC']), subscriptions: [] }]])
  engine.symbolConsumers = new Map([['BTC', new Set(['1', '2'])]])
  engine.ingest({ symbol: 'BTC', price: 105, changePct: 6, spanSeconds: 40 })
  assert.equal(engine.getState().running[0].matches.length, 1)
  assert.equal(engine.getState().running[1].matches.length, 0)
  assert.equal(engine.getState().uniqueSymbols, 1)
})

test('Event listeners run synchronously and event history is bounded', () => {
  const bus = new Events({ ruleLoader: async () => [] })
  let count = 0
  bus.on('market.data.received', () => count++)
  for (let i = 0; i < 70; i++) bus.publish('market.data.received', { symbol: 'BTC' })
  assert.equal(count, 70)
  assert.equal(bus.getState().recent.length, 60)
})
