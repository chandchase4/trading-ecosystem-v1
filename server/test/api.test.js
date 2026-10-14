import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../api.js'

test('HTTP and CLI share the command interpreter contract', async () => {
  const calls = []
  const app = createApp({
    executeCommand: async input => {
      calls.push(input)
      return { lines: [`Ran ${input}`], keepRunning: true }
    },
    readState: async () => ({ assets: ['BTC'], collections: [], scanners: [], registry: { uniqueAssets: 0 } }),
  })
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    const url = `http://127.0.0.1:${server.address().port}`
    const health = await fetch(`${url}/api/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).ok, true)

    const state = await fetch(`${url}/api/state`)
    assert.equal(state.status, 200)
    assert.deepEqual((await state.json()).state.assets, ['BTC'])

    const result = await fetch(`${url}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'collection add watchlist BTC, ETH' }),
    })
    assert.equal(result.status, 200)
    assert.deepEqual((await result.json()).lines, ['Ran collection add watchlist BTC, ETH'])
    assert.deepEqual(calls, ['collection add watchlist BTC, ETH'])

    const denied = await fetch(`${url}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'exit' }),
    })
    assert.equal(denied.status, 400)
    assert.equal(calls.length, 1)

    const invalid = await fetch(`${url}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nope: true }),
    })
    assert.equal(invalid.status, 400)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
