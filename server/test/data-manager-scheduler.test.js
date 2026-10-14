import test from 'node:test'
import assert from 'node:assert/strict'
import { DataManager } from '../services/DataManager.js'
import { RuleScheduler } from '../services/RuleScheduler.js'

test('Data Manager owns all provider callback ingress and subscriptions', async () => {
  const received = []
  const ingestion = { receive: value => { received.push(value); return true }, getState: () => ({}) }
  const stream = { sync: symbols => symbols, stop: () => {}, getState: () => ({ connection: 'idle' }) }
  const rest = { ticker: async symbol => ({ symbol }), getState: () => ({}) }
  const manager = new DataManager({ ingestion, rest, stream, getSubscriptions: () => ['sub-1'] })
  manager.start()
  assert.deepEqual(ingestion.subscriptionsFor('BTC'), ['sub-1'])
  rest.onData({ symbol: 'BTC', provider: 'coinbase' })
  stream.onData({ symbol: 'ETH', provider: 'coinbase' })
  assert.deepEqual(received.map(x => x.transport), ['rest', 'websocket'])
  assert.deepEqual(manager.syncSubscriptions(['BTC']), ['BTC'])
  assert.deepEqual(await manager.ticker('BTC'), { symbol: 'BTC' })
  manager.stop()
})

test('RuleScheduler emits named scheduled events without cross-firing rules', async () => {
  const events = []
  const rules = { find: () => ({ lean: async () => [
    { name: 'capture-a', trigger: 'schedule.capture-a', intervalSeconds: 10 },
    { name: 'capture-b', trigger: 'schedule.capture-b', intervalSeconds: 20 },
  ] }) }
  const scheduler = new RuleScheduler({ rules, publish: event => events.push(event) })
  await scheduler.tick(100_000)
  assert.equal(events.length, 0)
  await scheduler.tick(110_000)
  assert.deepEqual(events.map(e => e.type), ['schedule.capture-a'])
  await scheduler.tick(120_000)
  assert.deepEqual(events.map(e => e.type), ['schedule.capture-a', 'schedule.capture-a', 'schedule.capture-b'])
})

test('legacy snapshot process migration creates rules before deleting old processes', async () => {
  const created = []
  const removed = []
  const rules = { updateOne: async (_query, update) => { created.push(update.$setOnInsert) } }
  const processes = {
    find: () => ({ lean: async () => [{ _id: 'old-1', name: 'nightly', kind: 'snapshot', enabled: true, intervalSeconds: 900, config: { target: 'quotes' } }] }),
    deleteOne: async query => { removed.push(query) },
  }
  const scheduler = new RuleScheduler({ rules, processes })
  assert.equal(await scheduler.migrateLegacySnapshots(), 1)
  assert.equal(created[0].trigger, 'schedule.snapshot-nightly')
  assert.deepEqual(created[0].actions, [{ type: 'snapshot.capture', config: { type: 'quotes' } }])
  assert.equal(removed.length, 1)
})
