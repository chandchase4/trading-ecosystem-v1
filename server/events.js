import { EventRule, Collection, Asset } from './models.js'

export class Events {
  constructor({ ruleLoader = () => EventRule.find({ enabled: true }).lean() } = {}) {
    this.ruleLoader = ruleLoader
    this.listeners = new Map()
    this.recent = []
    this.alerts = []
    this.rules = []
    this.lastLoad = 0
    this.processing = Promise.resolve()
  }

  on(type, fn) {
    const callbacks = this.listeners.get(type) || new Set()
    callbacks.add(fn)
    this.listeners.set(type, callbacks)
    return () => callbacks.delete(fn)
  }

  async refreshRules() {
    this.rules = await this.ruleLoader()
    this.lastLoad = Date.now()
  }

  publish(type, data = {}, context = {}) {
    const event = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type, data, context, at: new Date().toISOString() }
    this.recent.unshift(event)
    this.recent.length = Math.min(60, this.recent.length)
    for (const callback of this.listeners.get(type) || []) {
      try { callback(event) } catch (error) { this.addError(error.message) }
    }
    // Rule actions are serialized outside the provider's hot data callback.
    this.processing = this.processing.then(() => this.dispatch(event))
      .catch(error => this.addError(error.message))
    return event
  }

  addError(message) {
    this.recent.unshift({ type: 'engine.error', data: { message }, at: new Date().toISOString() })
    this.recent.length = Math.min(60, this.recent.length)
  }

  async dispatch(event) {
    if (Date.now() - this.lastLoad > 10_000) await this.refreshRules()
    for (const rule of this.rules) {
      if (rule.trigger !== event.type || (rule.symbol && rule.symbol !== event.data.symbol)) continue
      if (rule.action === 'alert.record') {
        this.alerts.unshift({ id: event.id, rule: rule.name, event: event.type, symbol: event.data.symbol || '',
          at: event.at })
        this.alerts.length = Math.min(40, this.alerts.length)
      } else if (rule.action === 'collection.add' && rule.targetCollection && event.data.symbol) {
        const asset = await Asset.findOne({ symbol: event.data.symbol })
        if (!asset) continue
        const result = await Collection.updateOne({ _id: rule.targetCollection },
          { $addToSet: { assets: asset._id } })
        if (result.modifiedCount) this.publish('collection.asset.added',
          { symbol: asset.symbol, collectionId: String(rule.targetCollection) })
      }
    }
  }

  getState() { return { recent: this.recent, alerts: this.alerts } }
}

export const events = new Events()
