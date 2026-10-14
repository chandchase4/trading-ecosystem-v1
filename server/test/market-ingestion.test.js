import test from 'node:test'
import assert from 'node:assert/strict'
import { MarketIngestion } from '../services/MarketIngestion.js'

test('valid live updates publish structured events and register once per market', async () => {
  const events = []
  const registered = []
  const pipeline = new MarketIngestion({
    publish: event => events.push(event),
    subscriptionsFor: symbol => symbol === 'BTC' ? ['sub-1', 'sub-2'] : [],
    ensureAsset: async update => { registered.push(update.symbol); return true },
  })
  const tick = { symbol: 'BTC', marketSymbol: 'BTC-USD', provider: 'coinbase', price: 93000, volume24h: 12, timestamp: '2026-10-14T00:00:00Z' }
  assert.equal(pipeline.receive(tick), true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pipeline.receive({ ...tick, price: 93001 }), true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(registered, ['BTC'])
  assert.equal(events.length, 2)
  assert.equal(events[0].type, 'market.data.received')
  assert.deepEqual(events[0].data.subscriptionIds, ['sub-1', 'sub-2'])
  assert.deepEqual(events[0].context, [{ scope: 'subscription', id: 'sub-1' }, { scope: 'subscription', id: 'sub-2' }])
  assert.equal(pipeline.getState().registeredMarkets, 1)
})

test('rejects untrusted and invalid ticker data without events or writes', () => {
  const events = []
  const pipeline = new MarketIngestion({ publish: event => events.push(event), ensureAsset: async () => { throw new Error('should not run') } })
  assert.equal(pipeline.receive({ provider: 'unknown', symbol: 'BTC', marketSymbol: 'BTC-USD', price: 5 }), false)
  assert.equal(pipeline.receive({ provider: 'coinbase', symbol: 'BTC', marketSymbol: 'ETH-USD', price: 5 }), false)
  assert.equal(pipeline.receive({ provider: 'coinbase', symbol: 'BTC', marketSymbol: 'BTC-USD', price: -1 }), false)
  assert.equal(events.length, 0)
})
