import test from 'node:test'
import assert from 'node:assert/strict'
import { connectDatabase, disconnectDatabase } from '../db.js'
import * as catalog from '../services/catalog.js'
import { scanners } from '../services/scanners.js'

// Never run integration tests against a real user's Atlas database.
const testUri = 'mongodb://127.0.0.1:27017/trading_ecosystem_ci'
const enabled = process.env.TEST_MONGODB_URI === testUri

test('MongoDB-backed catalog and scanner lifecycle', { skip: !enabled }, async () => {
  process.env.MONGODB_URI = testUri
  await connectDatabase()

  try {
    assert.deepEqual(await catalog.addAsset('btc'), { symbol: 'BTC', created: true })
    assert.deepEqual(await catalog.addAsset('BTC'), { symbol: 'BTC', created: false })
    assert.deepEqual(await catalog.addAsset('eth'), { symbol: 'ETH', created: true })
    assert.deepEqual(await catalog.listAssets(), ['BTC', 'ETH'])

    assert.deepEqual(await catalog.createCollection('watchlist'), { name: 'watchlist', created: true })
    assert.deepEqual(await catalog.createCollection('secondary'), { name: 'secondary', created: true })
    assert.deepEqual(await catalog.createCollection('Watchlist'), { name: 'watchlist', created: false })

    assert.equal((await catalog.addMember('watchlist', 'BTC')).added, true)
    assert.equal((await catalog.addMember('watchlist', 'btc')).added, false)
    assert.equal((await catalog.addMember('watchlist', 'ETH')).added, true)
    assert.equal((await catalog.addMember('secondary', 'BTC')).added, true)
    assert.deepEqual((await catalog.showCollection('watchlist')).symbols, ['BTC', 'ETH'])
    await assert.rejects(catalog.addMember('missing', 'BTC'), /not found/)

    assert.deepEqual(await scanners.create('momentum'), { name: 'momentum', created: true })
    assert.equal((await scanners.attach('momentum', 'watchlist')).attached, true)
    assert.equal((await scanners.attach('momentum', 'secondary')).attached, true)
    assert.equal((await scanners.attach('momentum', 'secondary')).attached, false)

    const started = await scanners.start('momentum')
    assert.deepEqual(started.symbols, ['BTC', 'ETH'])
    assert.equal(started.subscriptions, 2)
    assert.equal(scanners.registry.uniqueAssetCount, 2)
    assert.equal(scanners.registry.referencesFor('BTC').length, 2)

    assert.equal((await catalog.removeMember('watchlist', 'ETH')).removed, true)
    assert.deepEqual((await scanners.sync('momentum')).symbols, ['BTC'])
    assert.equal((await scanners.status('momentum')).running, true)

    assert.equal((await scanners.detach('momentum', 'secondary')).detached, true)
    assert.equal(scanners.registry.referencesFor('BTC').length, 1)
    assert.equal((await scanners.stop('momentum')).stopped, true)
    assert.equal(scanners.registry.uniqueAssetCount, 0)
    assert.equal((await scanners.status('momentum')).running, false)
  } finally {
    await disconnectDatabase()
  }
})
