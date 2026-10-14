import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'

const mongo = process.env.TEST_MONGODB_URI
const getPort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close(() => resolve(port))
  })
})

test('HTTP editing workflow persists relationships and starts scanner', { skip: !mongo, timeout: 45000 }, async () => {
  const port = await getPort()
  const backend = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), MONGODB_URI: mongo, TEST_MONGODB_URI: mongo } })
  let log = ''
  backend.stdout.on('data', b => { log += b })
  backend.stderr.on('data', b => { log += b })
  const root = `http://127.0.0.1:${port}/api`
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(root + path, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const result = await response.json()
    assert.equal(response.status, 200, JSON.stringify({ path, result, log }))
    return result
  }
  try {
    let ready = false
    for (let i = 0; i < 80; i++) {
      await new Promise(resolve => setTimeout(resolve, 150))
      if (backend.exitCode !== null) throw Error('Backend exited: ' + log)
      try { const result = await request('/health'); if (result.ok) { ready = true; break } } catch {}
    }
    assert.ok(ready, 'Backend never started: ' + log)
    const suffix = String(Date.now()).slice(-8)
    const asset = 'BTC'
    await request('/assets', 'POST', { symbol: asset, name: 'Bitcoin', assetClass: 'crypto' })
    const collection = await request('/collections', 'POST', { name: 'watch-' + suffix })
    await request(`/collections/${collection.id}/assets`, 'POST', { symbol: asset })
    const process = await request('/processes', 'POST', { name: 'scanner-' + suffix, kind: 'scanner', minChangePct: 5 })
    await request('/subscriptions', 'POST', { processId: process.id, collectionId: collection.id })
    await request('/processes/' + process.id, 'PATCH', { enabled: true })
    const state = (await request('/state')).state
    assert.ok(state.assets.some(a => a.symbol === 'BTC'))
    assert.deepEqual(state.collections.find(c => c.id === collection.id).assets, ['BTC'])
    assert.ok(state.subscriptions.some(s => s.processId === process.id && s.collectionId === collection.id))
    assert.deepEqual(state.scanner.running.find(s => s.id === process.id).symbols, ['BTC'])
    await request('/processes/' + process.id, 'PATCH', { minChangePct: 7 })
    assert.equal((await request('/state')).state.processes.find(p => p.id === process.id).minChangePct, 7)
    await request('/subscriptions/' + state.subscriptions.find(s => s.processId === process.id).id, 'DELETE')
    await request('/processes/' + process.id, 'DELETE')
    await request('/collections/' + collection.id, 'DELETE')
    await request('/assets/BTC', 'DELETE')
    assert.equal((await request('/state')).state.assets.some(a => a.symbol === 'BTC'), false)
  } finally {
    backend.kill('SIGTERM')
    await new Promise(resolve => { if (backend.exitCode !== null) resolve(); else { backend.once('exit', resolve); setTimeout(resolve, 3500) } })
  }
})
