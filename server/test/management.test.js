import test from 'node:test'
import assert from 'node:assert/strict'
import { manage } from '../services/management.js'

test('management route validates requests before connecting to MongoDB', async () => {
  await assert.rejects(manage({ action: 'asset.update', payload: null }), /Invalid management request/)
  await assert.rejects(manage({ action: '', payload: {} }), /Invalid management request/)
})
