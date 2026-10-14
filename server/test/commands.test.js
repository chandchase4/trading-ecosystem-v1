import test from 'node:test'
import assert from 'node:assert/strict'
import { execute } from '../commands.js'

const services = {
  pingDatabase: async () => {},
  catalog: {
    addAsset: async symbol => ({ symbol: symbol.toUpperCase(), created: true }),
    listAssets: async () => ['BTC', 'TSLA'],
    deleteAsset: async symbol => ({ symbol, deleted: true }),
    createCollection: async name => ({ name, created: true }),
    listCollections: async () => ['watchlist'],
    showCollection: async name => ({ name, symbols: ['BTC', 'TSLA'] }),
    addMember: async (name, symbol) => ({ collection: name, symbol, added: true }),
    removeMember: async (name, symbol) => ({ collection: name, symbol, removed: true }),
    renameCollection: async (name, next) => ({ name, next, renamed: true }),
    deleteCollection: async name => ({ name, deleted: true }),
  },
  scanners: {
    create: async name => ({ name, created: true }),
    list: async () => ['momentum'],
    rename: async (name, next) => ({ name, next, renamed: true }),
    delete: async name => ({ name, deleted: true }),
    attach: async (name, collection) => ({ name, collection, attached: true }),
    detach: async (name, collection) => ({ name, collection, detached: true }),
    start: async name => ({ name, subscriptions: 1, symbols: ['BTC'] }),
    sync: async name => ({ name, subscriptions: 1, symbols: ['BTC'] }),
    stop: async name => ({ name, stopped: true }),
    status: async name => ({ name, running: true, collections: ['watchlist'], symbols: ['BTC'], totalUniqueAssets: 1 }),
    refreshActive: async () => {},
  },
}

test('help and exit do not need MongoDB', async () => {
  assert.match((await execute('help', services)).lines[0], /scanner rename/)
  assert.equal((await execute('exit', services)).keepRunning, false)
})

test('CRUD and comma-separated asset commands', async () => {
  assert.deepEqual((await execute('asset add btc', services)).lines, ['Added BTC.'])
  assert.deepEqual((await execute('asset list', services)).lines, ['1. BTC\n2. TSLA'])
  assert.deepEqual((await execute('asset add BTC, TSLA, BTC', services)).lines, ['Added 2 of 2: BTC, TSLA.'])
  assert.deepEqual((await execute('asset delete TSLA', services)).lines, ['Deleted asset TSLA.'])
})

test('collection commands create assets on add, and support rename/delete', async () => {
  assert.deepEqual((await execute('collection create watchlist', services)).lines, ['Created collection watchlist.'])
  assert.deepEqual((await execute('collection add watchlist BTC', services)).lines, ['Added BTC to watchlist.'])
  assert.deepEqual((await execute('collection add watchlist BTC, TSLA', services)).lines, ['Added 2 of 2 symbols to watchlist: BTC, TSLA.'])
  assert.deepEqual((await execute('collection show watchlist', services)).lines, ['watchlist: BTC, TSLA'])
  assert.deepEqual((await execute('collection remove watchlist BTC', services)).lines, ['Removed BTC from watchlist.'])
  assert.deepEqual((await execute('collection rename watchlist favorites', services)).lines, ['Renamed collection watchlist to favorites.'])
  assert.deepEqual((await execute('collection delete watchlist', services)).lines, ['Deleted collection watchlist and its attachments.'])
})

test('scanner CRUD and lifecycle commands are shared', async () => {
  assert.deepEqual((await execute('scanner create momentum', services)).lines, ['Created scanner momentum.'])
  assert.match((await execute('scanner attach momentum watchlist', services)).lines[0], /Attached watchlist/)
  assert.match((await execute('scanner start momentum', services)).lines[0], /No live price feed yet/)
  assert.match((await execute('scanner status momentum', services)).lines[0], /BTC/)
  assert.deepEqual((await execute('scanner rename momentum renamed', services)).lines, ['Renamed scanner momentum to renamed.'])
  assert.deepEqual((await execute('scanner stop momentum', services)).lines, ['momentum: registry stopped.'])
  assert.deepEqual((await execute('scanner detach momentum watchlist', services)).lines, ['Detached watchlist from momentum.'])
  assert.deepEqual((await execute('scanner delete momentum', services)).lines, ['Deleted scanner momentum and its subscriptions.'])
})

test('invalid input is rejected without calling services', async () => {
  await assert.rejects(execute('collection add watchlist', services), /Usage: collection add/)
  await assert.rejects(execute('asset add', services), /Usage: asset add/)
  await assert.rejects(execute('asset add A!,TSLA', services), /Invalid symbol/)
  await assert.rejects(execute('asset add ' + Array.from({length: 51}, ()=>'BTC').join(','), services), /Maximum 50/)
  await assert.rejects(execute('scanner delete momentum extra', services), /Usage: scanner delete/)
  await assert.rejects(execute('x'.repeat(1001), services), /under 1000/)
})

test('status pings database via the provided function', async () => {
  assert.deepEqual((await execute('status', services)).lines, ['MongoDB: connected'])
})
