import { EventEmitter } from 'node:events'
import EventRule from '../models/EventRule.js'
import { SnapshotManager } from './SnapshotManager.js'
import { marketDataHub } from './MarketDataHub.js'

// Only whitelisted actions may run: never evaluate persisted JavaScript.
const getPath = (root, path) => String(path).split('.').reduce((value, part) => value?.[part], root)
const matches = (condition, event) => {
  const actual = getPath(event, condition.path)
  const expected = condition.value
  switch (condition.operator) {
    case 'eq': return actual === expected
    case 'ne': return actual !== expected
    case 'gt': return typeof actual === 'number' && actual > expected
    case 'gte': return typeof actual === 'number' && actual >= expected
    case 'lt': return typeof actual === 'number' && actual < expected
    case 'lte': return typeof actual === 'number' && actual <= expected
    case 'in': return Array.isArray(expected) && expected.includes(actual)
    default: return false
  }
}

export class EventEngine {
  constructor({ loadRules = () => EventRule.find({ enabled: true }).lean(), hub = marketDataHub } = {}) {
    this.loadRules = loadRules
    this.hub = hub
    this.bus = new EventEmitter()
    this.rules = []
    this.cacheUntil = 0
    this.alerts = []
    this.recent = []
    this.snapshots = new SnapshotManager({
      onCreated: snapshot => this.publish({
        type: 'snapshot.created',
        source: { scope: 'snapshot', id: snapshot.id },
        data: { snapshotType: snapshot.type, sourceType: snapshot.source?.type },
      }),
    })
    this.bus.on('event', event => { void this.evaluate(event).catch(error => {
      this.recent.unshift({ type: 'engine.error', message: error.message, at: new Date().toISOString() })
    }) })
  }

  invalidate() { this.cacheUntil = 0 }
  async currentRules() {
    if (Date.now() >= this.cacheUntil) {
      this.rules = await this.loadRules()
      this.cacheUntil = Date.now() + 10_000
    }
    return this.rules
  }

  publish(event) {
    // Don't run effects inside a hot market-data callback.
    setImmediate(() => this.bus.emit('event', event))
  }

  async evaluate(event) {
    const results = []
    if (event.depth > 3) return results
    this.recent.unshift({ type: event.type, at: new Date().toISOString(), source: event.source })
    this.recent.length = Math.min(this.recent.length, 40)
    for (const rule of await this.currentRules()) {
      if (rule.trigger !== event.type) continue
      if (rule.target?.scope && rule.target.scope !== 'global') {
        const targetMatch = event.source?.scope === rule.target.scope && String(event.source?.id) === String(rule.target?.id)
        const contextMatch = (event.context || []).some(ref => ref.scope === rule.target.scope && String(ref.id) === String(rule.target.id))
        if (!targetMatch && !contextMatch) continue
      }
      if (!(rule.conditions || []).every(condition => matches(condition, event))) continue
      const output = { rule: rule.name, actions: [], status: 'completed' }
      let captured = null
      for (const action of rule.actions || []) {
        try {
          if (action.type === 'snapshot.capture') {
            captured = this.snapshots.capture({
              type: action.config?.type || 'event',
              source: event.source || { scope: 'global', id: '' },
              payload: { event, market: this.hub.getState(), previousAction: captured?.id },
            })
            output.actions.push({ type: action.type, snapshotId: captured.id })
          } else if (action.type === 'alert.record') {
            const alert = { id: String(Date.now()) + ':' + this.alerts.length,
              message: action.config?.message || rule.name,
              event: event.type, symbol: event.data?.symbol,
              snapshotId: captured?.id || null, at: new Date().toISOString(),
              demo: Boolean(event.demo),
            }
            this.alerts.unshift(alert)
            this.alerts.length = Math.min(this.alerts.length, 50)
            output.actions.push({ type: action.type, alertId: alert.id })
          } else if (action.type === 'collection.add') {
            if (!action.config?.collection || !event.data?.symbol) throw new Error('collection and event symbol required')
            const { addMember } = await import('./catalog.js')
            const added = await addMember(action.config.collection, event.data.symbol)
            output.actions.push({ type: action.type, added: added.added })
          }
        } catch (error) {
          output.status = 'failed'
          output.actions.push({ type: action.type, error: error.message })
          break
        }
      }
      results.push(output)
    }
    return results
  }

  getState() {
    return { alerts: [...this.alerts], recentEvents: [...this.recent],
      snapshots: this.snapshots.list(), snapshotStorage: this.snapshots.stats }
  }
}
export const eventEngine = new EventEngine()
