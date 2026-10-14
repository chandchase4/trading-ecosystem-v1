import { Asset } from './models.js'
import { events } from './events.js'

export const normalizeSymbol = value => {
  const symbol = String(value ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,19}$/.test(symbol)) throw new Error('Invalid asset symbol.')
  return symbol
}

export class AssetRegistry {
  constructor({ assetModel = Asset, publish = (type, data) => events.publish(type, data) } = {}) {
    this.assetModel = assetModel
    this.publish = publish
    this.known = new Set()
    this.pending = new Map()
  }

  async register({ symbol: raw, name = '', assetClass = 'unknown', provider, marketSymbol } = {}) {
    const symbol = normalizeSymbol(raw)
    if (!['stock', 'crypto', 'unknown'].includes(assetClass)) throw new Error('Invalid asset class.')
    const markets = provider && marketSymbol ? [{ provider, marketSymbol }] : []
    const result = await this.assetModel.updateOne({ symbol },
      { $setOnInsert: { symbol, name: String(name).slice(0, 120), assetClass, markets } }, { upsert: true })
    this.known.add(symbol)
    if (result.upsertedCount) this.publish('asset.created', { symbol, assetClass })
    return { symbol, created: Boolean(result.upsertedCount) }
  }

  // Concurrent ticks for a new symbol share one atomic upsert.
  async ensureFromData(update) {
    const symbol = normalizeSymbol(update.symbol)
    if (this.known.has(symbol)) return { symbol, created: false }
    if (this.pending.has(symbol)) return this.pending.get(symbol)
    const pending = this.register({ symbol, assetClass: 'crypto',
      provider: update.provider, marketSymbol: update.marketSymbol }).finally(() => this.pending.delete(symbol))
    this.pending.set(symbol, pending)
    return pending
  }

  forget(symbol) { this.known.delete(normalizeSymbol(symbol)) }
}

export const assetRegistry = new AssetRegistry()
