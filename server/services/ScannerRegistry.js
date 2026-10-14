import { normalizeSymbol } from '../lib/validation.js'

// Runtime-only registry. A symbol is stored once, but can have many subscriptions.
export class ScannerRegistry {
  constructor() {
    this.subscriptions = new Map()
    this.assets = new Map()
  }

  attach(subscriptionId, symbols) {
    const key = String(subscriptionId)
    const normalized = new Set(symbols.map(normalizeSymbol))
    this.detach(key)
    this.subscriptions.set(key, normalized)

    for (const symbol of normalized) {
      if (!this.assets.has(symbol)) this.assets.set(symbol, new Set())
      this.assets.get(symbol).add(key)
    }
  }

  detach(subscriptionId) {
    const key = String(subscriptionId)
    const previous = this.subscriptions.get(key)
    if (!previous) return false
    for (const symbol of previous) {
      const refs = this.assets.get(symbol)
      refs.delete(key)
      if (refs.size === 0) this.assets.delete(symbol)
    }
    this.subscriptions.delete(key)
    return true
  }

  symbolsFor(subscriptionIds) {
    const symbols = new Set()
    for (const id of subscriptionIds) {
      for (const symbol of this.subscriptions.get(String(id)) ?? []) symbols.add(symbol)
    }
    return [...symbols].sort()
  }

  referencesFor(symbol) {
    return [...(this.assets.get(normalizeSymbol(symbol)) ?? [])].sort()
  }

  get uniqueAssetCount() {
    return this.assets.size
  }
}
