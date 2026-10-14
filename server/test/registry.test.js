import test from 'node:test'
import assert from 'node:assert/strict'
import { ScannerRegistry } from '../services/ScannerRegistry.js'

test('deduplicates a symbol across multiple subscriptions', () => {
  const registry = new ScannerRegistry()
  registry.attach('one', ['BTC', 'TSLA', 'BTC'])
  registry.attach('two', ['BTC', 'ETH'])
  assert.equal(registry.uniqueAssetCount, 3)
  assert.deepEqual(registry.referencesFor('btc'), ['one', 'two'])
  assert.deepEqual(registry.symbolsFor(['one']), ['BTC', 'TSLA'])
})

test('detaching one subscription keeps symbols needed by another', () => {
  const registry = new ScannerRegistry()
  registry.attach('one', ['BTC', 'TSLA'])
  registry.attach('two', ['BTC'])
  registry.detach('one')
  assert.equal(registry.uniqueAssetCount, 1)
  assert.deepEqual(registry.referencesFor('BTC'), ['two'])
  registry.detach('two')
  assert.equal(registry.uniqueAssetCount, 0)
})

test('refreshing a subscription drops stale symbols', () => {
  const registry = new ScannerRegistry()
  registry.attach('s1', ['BTC'])
  registry.attach('s1', ['SOL', 'SOL'])
  assert.deepEqual(registry.referencesFor('BTC'), [])
  assert.deepEqual(registry.symbolsFor(['s1']), ['SOL'])
})
