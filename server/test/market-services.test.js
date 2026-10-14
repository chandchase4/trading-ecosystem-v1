import test from 'node:test'
import assert from 'node:assert/strict'
import { MarketWindowBuffer } from '../services/MarketWindowBuffer.js'
import { MarketDataHub } from '../services/MarketDataHub.js'
import { SnapshotManager } from '../services/SnapshotManager.js'
import { EventEngine } from '../services/EventEngine.js'

test('market window keeps a capped one-second rolling sample, not every tick', () => {
  const buffer = new MarketWindowBuffer({ windowMs: 300_000, maxPoints: 3, maxSymbols: 1 })
  buffer.add('BTC', { price: 100, timestamp: 1_000_000 })
  buffer.add('BTC', { price: 101, timestamp: 1_000_500 })
  assert.equal(buffer.get('BTC').length, 1)
  buffer.add('BTC', { price: 105, timestamp: 1_001_000 })
  assert.equal(buffer.get('BTC').length, 2)
  const window = buffer.add('BTC', { price: 110, timestamp: 1_300_002 })
  assert.equal(buffer.get('BTC').length, 1)
  assert.equal(window.changeWindowPct, 0)
  assert.equal(buffer.add('TSLA', { price: 100, timestamp: 1_300_002 }), null)
  buffer.prune([])
  assert.equal(buffer.observationCount, 0)
})

test('market hub rejects bad prices and exposes only current active assets', () => {
  const hub = new MarketDataHub({ socketFactory: () => { throw new Error('no network') } })
  hub.active.add('BTC')
  hub.ingest({ symbol: 'BTC', price: 100, provider: 'coinbase', marketSymbol: 'BTC-USD', timestamp: 1000 })
  hub.ingest({ symbol: 'BTC', price: 'bad', timestamp: 2000 })
  hub.ingest({ symbol: 'TSLA', price: 900, timestamp: 2000 })
  assert.deepEqual(hub.getState().quotes.map(q => q.symbol), ['BTC'])
  assert.equal(hub.getState().quotes[0].price, 100)
  hub.stop()
})

test('snapshots evict oldest unpinned state and refuse to evict pinned data', () => {
  const manager = new SnapshotManager({ maxCount: 2, maxBytes: 100000 })
  const a = manager.capture({ type: 'result', source: { type: 'process' }, payload: { x: 1 } })
  manager.pin(a.id)
  const b = manager.capture({ type: 'result', source: { type: 'process' }, payload: { x: 2 } })
  manager.capture({ type: 'result', source: { type: 'process' }, payload: { x: 3 } })
  assert.ok(manager.get(a.id))
  assert.equal(manager.get(b.id), null)
  assert.equal(manager.list().length, 2)
  manager.list().forEach(item => manager.pin(item.id))
  assert.throws(() => manager.capture({ type: 'result', source: { type: 'process' }, payload: {} }), /only pinned/)
})

test('event engine evaluates conditions and passes snapshot to alert action', async () => {
  const rules = [{
    name: 'sample', trigger: 'market.momentum.detected',
    target: { scope: 'global' },
    conditions: [{ path: 'data.changePct', operator: 'gte', value: 5 }],
    actions: [{ type: 'snapshot.capture', config: { type: 'event' } }, { type: 'alert.record', config: { message: 'BTC moved' } }],
  }]
  const engine = new EventEngine({ loadRules: async () => rules, hub: { getState: () => ({ quotes: [] }) } })
  const missed = await engine.evaluate({ type: 'market.momentum.detected', data: { symbol: 'BTC', changePct: 3 } })
  assert.equal(missed.length, 0)
  const hit = await engine.evaluate({ type: 'market.momentum.detected', source: { scope: 'asset', id: 'BTC' }, data: { symbol: 'BTC', changePct: 5.1 }, demo: true })
  assert.equal(hit.length, 1)
  assert.equal(hit[0].actions.length, 2)
  assert.equal(engine.getState().alerts[0].snapshotId, engine.getState().snapshots[0].id)
})
