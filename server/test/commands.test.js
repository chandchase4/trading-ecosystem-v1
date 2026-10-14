import test from 'node:test'
import assert from 'node:assert/strict'
import { execute } from '../commands.js'

const services = {
  pingDatabase: async () => {},
  catalog: {
    addAsset: async (symbol) => ({ symbol: symbol.toUpperCase(), created: true }),
    listAssets: async () => ['BTC', 'TSLA'],
    createCollection: async (name) => ({ name, created: true }),
    listCollections: async () => ['watchlist'],
    showCollection: async (name) => ({ name, symbols: ['BTC', 'TSLA'] }),
    addMember: async (name, symbol) => ({ collection: name, symbol, added: true }),
    removeMember: async (name, symbol) => ({ collection: name, symbol, removed: true }),
  },
}

test('help and exit do not require MongoDB', async () => {
  assert.match((await execute('help', services)).lines[0], /collection create/)
  assert.equal((await execute('exit', services)).keepRunning, false)
})

test('asset and collection commands dispatch to the catalog', async () => {
  assert.deepEqual((await execute('asset add btc', services)).lines, ['Added BTC.'])
  assert.deepEqual((await execute('asset list', services)).lines, ['1. BTC\n2. TSLA'])
  assert.deepEqual((await execute('collection create watchlist', services)).lines, ['Created collection watchlist.'])
  assert.deepEqual((await execute('collection add watchlist BTC', services)).lines, ['Added BTC to watchlist.'])
  assert.deepEqual((await execute('collection show watchlist', services)).lines, ['watchlist: BTC, TSLA'])
  assert.deepEqual((await execute('collection remove watchlist BTC', services)).lines, ['Removed BTC from watchlist.'])
})

test('invalid argument counts fail explicitly', async () => {
  await assert.rejects(execute('collection add watchlist', services), /Usage: collection add/)
  await assert.rejects(execute('asset add', services), /Usage: asset add/)
})

test('status pings MongoDB through the injected function', async () => {
  assert.deepEqual((await execute('status', services)).lines, ['MongoDB: connected'])
})

test('scanner commands dispatch to the service', async () => {
  const mock = {
    ...services,
    scanners: {
      create: async name => ({ name, created: true }),
      list: async () => ['momentum'],
      attach: async (name, collection) => ({ name, collection, attached: true }),
      detach: async (name, collection) => ({ name, collection, detached: true }),
      start: async name => ({ name, subscriptions: 1, symbols: ['BTC'] }),
      sync: async name => ({ name, subscriptions: 1, symbols: ['BTC'] }),
      stop: async name => ({ name, stopped: true }),
      status: async name => ({ name, running: true, collections: ['watchlist'], symbols: ['BTC'], totalUniqueAssets: 1 }),
    },
  }
  assert.deepEqual((await execute('scanner create momentum', mock)).lines, ['Created scanner momentum.'])
  assert.match((await execute('scanner attach momentum watchlist', mock)).lines[0], /Attached watchlist/)
  assert.match((await execute('scanner start momentum', mock)).lines[0], /No live price feed yet/)
  assert.match((await execute('scanner status momentum', mock)).lines[0], /BTC/)
  assert.match((await execute('scanner stop momentum', mock)).lines[0], /registry stopped/)
  assert.match((await execute('scanner detach momentum watchlist', mock)).lines[0], /Detached watchlist/)
})
