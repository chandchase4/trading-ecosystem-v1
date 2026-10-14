import { connectDatabase } from '../db.js'
import { normalizeSymbol, normalizeName } from '../lib/validation.js'
import Asset from '../models/Asset.js'
import Membership from '../models/Membership.js'
import Process from '../models/Process.js'
import Provider from '../models/Provider.js'
import EventRule from '../models/EventRule.js'
import { eventEngine } from './EventEngine.js'

const fail = message => { throw new Error(message) }
const text = (value, max = 100) => {
  if (typeof value !== 'string' || value.length > max) fail('Invalid text field.')
  return value.trim()
}
const intRange = (value, min, max) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) fail(`Expected an integer between ${min} and ${max}.`)
  return n
}
const positive = (value, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > max) fail('Invalid numeric value.')
  return n
}
const ruleName = name => normalizeName(name)
const triggerPattern = /^[a-z][a-z0-9_.]{2,79}$/
const eventScopes = ['global','asset','collection','membership','process','subscription','snapshot']
const operators = ['eq','ne','gt','gte','lt','lte','in']
const actions = ['snapshot.capture','alert.record','collection.add']
const conditionsField = (value) => {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value) || value.length > 8) fail('Rules may contain at most eight conditions.')
  return value.map(c => {
    if (!c || typeof c !== 'object' || typeof c.path !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.]{0,79}$/.test(c.path) || !operators.includes(c.operator)) fail('Invalid rule condition.')
    const v = c.value
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean' && !Array.isArray(v)) fail('Rule values must be text, numbers, booleans, or lists.')
    if (Array.isArray(v) && (v.length > 20 || v.some(x => !['string','number','boolean'].includes(typeof x)))) fail('Invalid rule list.')
    return { path: c.path, operator: c.operator, value: v }
  })
}
const actionField = (value) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) fail('Rules need 1–8 actions.')
  return value.map(item => {
    if (!item || !actions.includes(item.type)) fail('Unsupported event action.')
    const config = item.config || {}
    if (item.type === 'collection.add') return { type: item.type, config: { collection: normalizeName(config.collection) } }
    if (item.type === 'snapshot.capture') return { type: item.type, config: { type: text(config.type || 'event', 60) } }
    return { type: item.type, config: { message: text(config.message || 'Event triggered', 160) } }
  })
}

export async function manage({ action, payload } = {}) {
  if (typeof action !== 'string' || !action.trim() || !payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Invalid management request.')
  await connectDatabase()
  switch (action) {
    case 'asset.update': {
      const symbol = normalizeSymbol(payload.symbol)
      const asset = await Asset.findOne({ symbol })
      if (!asset) fail('Asset not found.')
      const name = text(payload.name ?? '', 120)
      const assetClass = payload.assetClass
      if (!['stock','crypto','unknown'].includes(assetClass)) fail('Invalid asset class.')
      const note = text(payload.note ?? '', 1000)
      asset.name = name
      asset.assetClass = assetClass
      asset.userData = { ...(asset.userData || {}), note }
      await asset.save()
      eventEngine.publish({ type: 'asset.updated', source: { scope: 'asset', id: symbol }, data: { symbol } })
      return { message: `Saved ${symbol}.` }
    }
    case 'market.add': {
      const asset = await Asset.findOne({ symbol: normalizeSymbol(payload.symbol) })
      if (!asset) fail('Asset not found.')
      const symbol = normalizeSymbol(payload.marketSymbol)
      const provider = normalizeName(payload.provider)
      const exchange = normalizeName(payload.exchange)
      if (asset.markets.some(m => m.symbol === symbol && m.provider === provider && m.exchange === exchange)) fail('That market already exists.')
      if (asset.markets.length >= 30) fail('Maximum 30 markets per asset.')
      asset.markets.push({
        symbol, provider, exchange,
        base: asset.symbol, quote: text(payload.quote || '', 12).toUpperCase(),
        activityRank: intRange(payload.activityRank || 1, 1, 10000), verified: false,
      })
      await asset.save()
      eventEngine.publish({ type: 'asset.updated', source: { scope: 'asset', id: asset.symbol }, data: { symbol: asset.symbol } })
      return { message: `Added market ${symbol} (${provider}/${exchange}); unverified until a provider confirms it.` }
    }
    case 'market.remove': {
      const asset = await Asset.findOne({ symbol: normalizeSymbol(payload.symbol) })
      if (!asset) fail('Asset not found.')
      const symbol = normalizeSymbol(payload.marketSymbol)
      const provider = normalizeName(payload.provider)
      const exchange = normalizeName(payload.exchange)
      const old = asset.markets.length
      asset.markets = asset.markets.filter(m => !(m.symbol === symbol && m.provider === provider && m.exchange === exchange))
      if (old === asset.markets.length) fail('Market entry not found.')
      await asset.save()
      return { message: `Removed ${symbol} market entry. Existing membership preferences are unchanged.` }
    }
    case 'membership.update': {
      const doc = await Membership.findById(text(payload.id, 40))
      if (!doc) fail('Membership not found.')
      const marketSymbol = payload.marketSymbol ? normalizeSymbol(payload.marketSymbol) : ''
      doc.preferences.provider = payload.provider ? normalizeName(payload.provider) : ''
      doc.preferences.exchange = payload.exchange ? normalizeName(payload.exchange) : ''
      doc.preferences.marketSymbol = marketSymbol
      doc.preferences.priority = intRange(payload.priority, 0, 100)
      doc.preferences.notes = text(payload.notes ?? '', 500)
      await doc.save()
      eventEngine.publish({ type: 'membership.updated', source: { scope: 'membership', id: String(doc._id) }, data: { marketSymbol, priority: doc.preferences.priority } })
      return { message: 'Membership preferences saved. Live feed routing does not use overrides yet.' }
    }
    case 'process.create': {
      const name = normalizeName(payload.name)
      const kind = payload.kind
      if (kind !== 'discovery') fail('Create scanners using scanner controls.')
      if (await Process.exists({ name })) fail('A process with that name already exists.')
      await Process.create({ name, kind, enabled: false, intervalSeconds: 300 })
      return { message: `Created disabled discovery process ${name}. Discovery execution is not available yet.` }
    }
    case 'process.delete': {
      const name = normalizeName(payload.name)
      const doc = await Process.findOne({ name })
      if (!doc) fail('Process not found.')
      if (doc.kind === 'scanner') fail('Use the scanner controls to delete scanner processes.')
      if (doc.enabled) fail('Disable the process before deleting it.')
      await Process.deleteOne({ _id: doc._id })
      return { message: `Deleted ${name}.` }
    }
    case 'process.update': {
      const name = normalizeName(payload.name)
      const doc = await Process.findOne({ name })
      if (!doc) fail('Process not found.')
      fail('Process configuration is not available here; snapshots are EventRule actions.')
    }
    case 'provider.update': {
      const slug = normalizeName(payload.slug)
      const doc = await Provider.findOne({ slug })
      if (!doc) fail('Provider not found.')
      doc.settings.priority = intRange(payload.priority, 1, 10000)
      doc.settings.enabled = payload.enabled === true
      await doc.save()
      return { message: `Saved ${doc.name} configuration. This setting does not activate a new provider adapter.` }
    }
    case 'rule.save': {
      const name = ruleName(payload.name)
      const existing = await EventRule.findOne({ name })
      const trigger = text(payload.trigger, 80)
      if (!triggerPattern.test(trigger)) fail('Invalid event trigger.')
      const scope = text(payload.scope || 'global', 20)
      if (!eventScopes.includes(scope)) fail('Invalid rule scope.')
      const id = scope === 'global' ? '' : text(payload.targetId ?? '', 100)
      if (scope !== 'global' && !id) fail('A target ID is required for scoped rules.')
      const conditions = conditionsField(payload.conditions || [])
      const parsedActions = actionField(payload.actions)
      const intervalSeconds = trigger.startsWith('schedule.') ? intRange(payload.intervalSeconds ?? 300, 5, 86400) : 300
      if (trigger.startsWith('schedule.') && trigger !== `schedule.${name}`) fail('Scheduled triggers must be schedule.<rule-name>.')
      const fields = { name, target: { scope, id }, trigger, intervalSeconds, conditions, actions: parsedActions, enabled: payload.enabled === true }
      if (existing) { existing.set(fields); await existing.save() }
      else await EventRule.create(fields)
      eventEngine.invalidate()
      return { message: `Event rule ${name} ${existing ? 'updated' : 'created'}.` }
    }
    case 'rule.delete': {
      const name = ruleName(payload.name)
      const removed = await EventRule.deleteOne({ name })
      if (!removed.deletedCount) fail('Event rule not found.')
      eventEngine.invalidate()
      return { message: `Event rule ${name} deleted.` }
    }
    case 'snapshot.pin': {
      const snapshot = eventEngine.snapshots.pin(text(payload.id, 100), payload.pinned === true)
      return { message: `Snapshot ${snapshot.id} ${snapshot.pinned ? 'protected' : 'unprotected'}.` }
    }
    case 'snapshot.delete': {
      const id = text(payload.id, 100)
      eventEngine.snapshots.remove(id)
      return { message: 'Snapshot discarded from temporary memory.' }
    }
    default: fail('Unsupported management action.')
  }
}
