import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSymbol, normalizeName } from '../lib/validation.js'

test('normalizes asset symbols', () => {
  assert.equal(normalizeSymbol(' btc-usdt '), 'BTC-USDT')
  assert.equal(normalizeSymbol('nasdaq:aapl'), 'NASDAQ:AAPL')
  assert.throws(() => normalizeSymbol('bad symbol'), /Invalid symbol/)
  assert.throws(() => normalizeSymbol(''), /Invalid symbol/)
})

test('normalizes collection names', () => {
  assert.equal(normalizeName(' My_Watchlist '), 'my_watchlist')
  assert.throws(() => normalizeName('../bad'), /Invalid collection name/)
  assert.throws(() => normalizeName('spaces not supported'), /Invalid collection name/)
})
