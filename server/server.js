import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from './db.js'
import { Asset, Collection, Process, Subscription, EventRule } from './models.js'
import { assetRegistry, normalizeSymbol } from './assetRegistry.js'
import { scannerEngine } from './scannerEngine.js'
import { dataManager } from './dataManager.js'
import { events } from './events.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '12kb' }))
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

const ok = (res, result) => res.json({ ok: true, ...result })
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
const name = value => {
  const n = String(value ?? '').trim()
  if (!n || n.length > 60) throw fail('Name must have 1–60 characters.')
  return n
}
const objectId = value => {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw fail('Invalid record ID.')
  return value
}
const str = (value, max = 120) => String(value ?? '').trim().slice(0, max)
const truthy = value => value === true
const pct = value => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1000) throw fail('Change threshold must be 0–1000%.')
  return n
}
const refresh = async () => dataManager.sync(await scannerEngine.reload())
const present = doc => ({ ...doc, id: String(doc._id), _id: undefined, __v: undefined })

app.get('/api/health', (_req, res) => ok(res, { database: mongoose.connection.readyState === 1 ? 'connected' : 'offline' }))
app.get('/api/state', async (_req, res) => {
  const [assets, collections, processes, subscriptions, rules] = await Promise.all([
    Asset.find().sort({ symbol: 1 }).lean(),
    Collection.find().sort({ name: 1 }).populate('assets', 'symbol').lean(),
    Process.find().sort({ name: 1 }).lean(),
    Subscription.find().populate('process', 'name kind').populate('collection', 'name').lean(),
    EventRule.find().sort({ name: 1 }).lean(),
  ])
  ok(res, { state: {
    assets: assets.map(present),
    collections: collections.map(doc => ({ ...present(doc), assets: (doc.assets || []).filter(Boolean).map(a => a.symbol) })),
    processes: processes.map(present),
    subscriptions: subscriptions.filter(s => s.process && s.collection).map(s => ({
      id: String(s._id), processId: String(s.process._id), processName: s.process.name,
      collectionId: String(s.collection._id), collectionName: s.collection.name })),
    rules: rules.map(present), events: events.getState(), scanner: scannerEngine.getState(),
    dataManager: dataManager.getState(),
  } })
})

app.post('/api/assets', async (req, res) => {
  const result = await assetRegistry.register({ symbol: req.body?.symbol, name: str(req.body?.name),
    assetClass: req.body?.assetClass || 'unknown' })
  await refresh()
  ok(res, result)
})
app.patch('/api/assets/:symbol', async (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol)
  const changes = {}
  if ('name' in req.body) changes.name = str(req.body.name)
  if ('assetClass' in req.body) {
    if (!['stock', 'crypto', 'unknown'].includes(req.body.assetClass)) throw fail('Invalid asset class.')
    changes.assetClass = req.body.assetClass
  }
  if (!Object.keys(changes).length) throw fail('No changes provided.')
  const result = await Asset.updateOne({ symbol }, { $set: changes })
  if (!result.matchedCount) throw fail('Asset not found.', 404)
  events.publish('asset.updated', { symbol })
  ok(res, {})
})
app.delete('/api/assets/:symbol', async (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol)
  const asset = await Asset.findOneAndDelete({ symbol })
  if (!asset) throw fail('Asset not found.', 404)
  await Collection.updateMany({}, { $pull: { assets: asset._id } })
  assetRegistry.forget(symbol)
  await refresh()
  events.publish('asset.deleted', { symbol })
  ok(res, {})
})

app.post('/api/collections', async (req, res) => {
  const collection = await Collection.create({ name: name(req.body?.name), assets: [] })
  events.publish('collection.created', { name: collection.name })
  ok(res, { id: String(collection._id) })
})
app.patch('/api/collections/:id', async (req, res) => {
  const collection = await Collection.findByIdAndUpdate(objectId(req.params.id),
    { $set: { name: name(req.body?.name) } }, { new: true })
  if (!collection) throw fail('Collection not found.', 404)
  ok(res, {})
})
app.delete('/api/collections/:id', async (req, res) => {
  const id = objectId(req.params.id)
  if (!await Collection.findByIdAndDelete(id)) throw fail('Collection not found.', 404)
  await Subscription.deleteMany({ collection: id })
  await EventRule.updateMany({ targetCollection: id }, { $set: { enabled: false, targetCollection: null } })
  events.lastLoad = 0
  await refresh()
  ok(res, {})
})
app.post('/api/collections/:id/assets', async (req, res) => {
  const id = objectId(req.params.id)
  const symbol = normalizeSymbol(req.body?.symbol)
  const asset = await Asset.findOne({ symbol })
  if (!asset) throw fail('Register the asset first.', 404)
  const result = await Collection.updateOne({ _id: id }, { $addToSet: { assets: asset._id } })
  if (!result.matchedCount) throw fail('Collection not found.', 404)
  await refresh()
  if (result.modifiedCount) events.publish('collection.asset.added', { symbol, collectionId: id })
  ok(res, {})
})
app.delete('/api/collections/:id/assets/:symbol', async (req, res) => {
  const id = objectId(req.params.id)
  const asset = await Asset.findOne({ symbol: normalizeSymbol(req.params.symbol) })
  if (!asset) throw fail('Asset not found.', 404)
  const result = await Collection.updateOne({ _id: id }, { $pull: { assets: asset._id } })
  if (!result.matchedCount) throw fail('Collection not found.', 404)
  await refresh()
  ok(res, {})
})

app.post('/api/processes', async (req, res) => {
  const kind = req.body?.kind || 'scanner'
  if (!['scanner', 'discovery'].includes(kind)) throw fail('Invalid process kind.')
  const process = await Process.create({ name: name(req.body?.name), kind, enabled: false,
    minChangePct: pct(req.body?.minChangePct ?? 5) })
  ok(res, { id: String(process._id) })
})
app.patch('/api/processes/:id', async (req, res) => {
  const patch = {}
  if ('name' in req.body) patch.name = name(req.body.name)
  if ('enabled' in req.body) patch.enabled = truthy(req.body.enabled)
  if ('minChangePct' in req.body) patch.minChangePct = pct(req.body.minChangePct)
  const process = await Process.findById(objectId(req.params.id))
  if (!process) throw fail('Process not found.', 404)
  if (process.kind === 'discovery' && patch.enabled) throw fail('Discovery engine is not implemented in the MVP.')
  Object.assign(process, patch)
  await process.save()
  await refresh()
  events.publish(process.enabled ? 'process.started' : 'process.updated',
    { processId: String(process._id), kind: process.kind })
  ok(res, {})
})
app.delete('/api/processes/:id', async (req, res) => {
  const id = objectId(req.params.id)
  if (!await Process.findByIdAndDelete(id)) throw fail('Process not found.', 404)
  await Subscription.deleteMany({ process: id })
  await refresh()
  ok(res, {})
})

app.post('/api/subscriptions', async (req, res) => {
  const processId = objectId(req.body?.processId)
  const collectionId = objectId(req.body?.collectionId)
  if (!await Process.exists({ _id: processId }) || !await Collection.exists({ _id: collectionId }))
    throw fail('Process or collection does not exist.')
  const result = await Subscription.updateOne({ process: processId, collection: collectionId },
    { $setOnInsert: { process: processId, collection: collectionId } }, { upsert: true })
  await refresh()
  ok(res, { created: Boolean(result.upsertedCount) })
})
app.delete('/api/subscriptions/:id', async (req, res) => {
  const result = await Subscription.deleteOne({ _id: objectId(req.params.id) })
  if (!result.deletedCount) throw fail('Subscription not found.', 404)
  await refresh()
  ok(res, {})
})

const validRule = data => {
  const trigger = str(data?.trigger, 80)
  if (!/^[a-z][a-z0-9.]{2,64}$/.test(trigger)) throw fail('Invalid event trigger.')
  if (!['alert.record', 'collection.add'].includes(data?.action)) throw fail('Invalid event action.')
  const symbol = data?.symbol ? normalizeSymbol(data.symbol) : ''
  if (data.action === 'collection.add' && !mongoose.isValidObjectId(data.targetCollection))
    throw fail('Choose a destination collection.')
  return { name: name(data.name), trigger, symbol, action: data.action,
    enabled: truthy(data.enabled), targetCollection: data.action === 'collection.add' ? data.targetCollection : null }
}
app.post('/api/events/rules', async (req, res) => {
  const rule = await EventRule.create(validRule(req.body))
  events.lastLoad = 0
  ok(res, { id: String(rule._id) })
})
app.patch('/api/events/rules/:id', async (req, res) => {
  const rule = await EventRule.findByIdAndUpdate(objectId(req.params.id),
    { $set: validRule(req.body) }, { runValidators: true, new: true })
  if (!rule) throw fail('Rule not found.', 404)
  events.lastLoad = 0
  ok(res, {})
})
app.delete('/api/events/rules/:id', async (req, res) => {
  const result = await EventRule.deleteOne({ _id: objectId(req.params.id) })
  if (!result.deletedCount) throw fail('Rule not found.', 404)
  events.lastLoad = 0
  ok(res, {})
})

app.post('/api/data/pull', async (req, res) => {
  ok(res, { quote: await dataManager.pull(req.body?.symbol) })
})
app.use((error, _req, res, _next) => {
  const duplicate = error?.code === 11000
  const validation = error?.name === 'ValidationError' || error?.name === 'CastError'
  const status = error.status || (duplicate || validation ? 400 : 500)
  console.error('API error:', error.message)
  res.status(status).json({ ok: false, error: duplicate ? 'That name or symbol already exists.' : error.message })
})

const port = Number(process.env.PORT || 3001)
try {
  await connectDatabase()
  // If an event rule promotes an asset, refresh active scanner subscriptions.
  events.on('collection.asset.added', () => {
    void refresh().catch(error => console.error('Scanner sync failed:', error.message))
  })
  await refresh()
  console.log('MongoDB connected. Trading Ecosystem MVP ready.')
  const server = app.listen(port, '127.0.0.1', () => console.log(`API listening on port ${port}`))
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    dataManager.stop()
    server.close(() => { void disconnectDatabase().finally(() => process.exit(0)) })
  })
} catch (error) {
  console.error('Startup failed:', error.message)
  process.exitCode = 1
}
