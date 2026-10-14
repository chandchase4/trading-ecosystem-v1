import test from 'node:test'
import assert from 'node:assert/strict'
import { connectDatabase, disconnectDatabase } from '../db.js'
import * as catalog from '../services/catalog.js'
import { scanners } from '../services/scanners.js'
import { createApp } from '../api.js'

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

    // Exercise the exact HTTP boundary used by React and the CLI. The server,
    // command interpreter, MongoDB and runtime registry must agree.
    const app = createApp()
    const server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    })
    try {
      const base = `http://127.0.0.1:${server.address().port}`
      async function command(value) {
        const response = await fetch(`${base}/api/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: value }),
        })
        const payload = await response.json()
        assert.equal(response.status, 200, `Failed "${value}": ${JSON.stringify(payload)}`)
        return payload
      }
      async function state() {
        const response = await fetch(`${base}/api/state`)
        assert.equal(response.status, 200)
        return (await response.json()).state
      }

      await command('scanner start momentum')
      await command('collection add watchlist SOL, ADA')
      const snapshot = await state()
      assert.deepEqual(snapshot.collections.find(item => item.name === 'watchlist').symbols, ['ADA', 'BTC', 'SOL'])
      assert.deepEqual(snapshot.scanners.find(item => item.name === 'momentum').symbols, ['ADA', 'BTC', 'SOL'])
      assert.equal(snapshot.registry.uniqueAssets, 3)

      await command('scanner rename momentum momentum-v2')
      assert.equal((await state()).scanners[0].name, 'momentum-v2')
      await command('scanner delete momentum-v2')
      assert.deepEqual((await state()).scanners, [])

      await command('collection rename watchlist favorites')
      assert.ok((await state()).collections.some(item => item.name === 'favorites'))
      await command('collection delete favorites')
      assert.ok(!(await state()).collections.some(item => item.name === 'favorites'))

      await command('asset delete SOL, ADA')
      assert.deepEqual((await state()).assets, ['BTC', 'ETH'])
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  } finally {
    await disconnectDatabase()
  }
})
