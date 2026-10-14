import Asset from '../models/Asset.js'
import { connectDatabase } from '../db.js'
import { eventEngine } from './EventEngine.js'

// Trusted provider updates enter here, not arbitrary client-submitted events.
// A bounded per-market cache avoids a MongoDB lookup on every market tick.
export class MarketIngestion {
  constructor({ publish = event => eventEngine.publish(event), ensureAsset = null, subscriptionsFor = () => [] } = {}) {
    this.publish = publish
    this.ensureAsset = ensureAsset ?? this.saveAsset.bind(this)
    this.subscriptionsFor = subscriptionsFor
    this.seen = new Map()
    this.pending = new Set()
    this.errors = []
  }

  async saveAsset(update) {
    await connectDatabase()
    await Asset.init()
    const market = {
      symbol: update.marketSymbol,
      base: update.symbol,
      quote: update.marketSymbol.split('-')[1] || '',
      provider: update.provider,
      exchange: update.provider,
      verified: false,
    }
    const result = await Asset.updateOne(
      { symbol: update.symbol },
      { $setOnInsert: { symbol: update.symbol, assetClass: 'crypto', markets: [market] } },
      { upsert: true },
    )
    if (result.upsertedCount) {
      this.publish({
        type: 'asset.created',
        source: { scope: 'asset', id: update.symbol },
        data: { symbol: update.symbol, provider: update.provider, marketSymbol: update.marketSymbol, origin: 'market.data.received' },
      })
    }
    return result.upsertedCount === 1
  }

  receive(update) {
    if (update?.provider !== 'coinbase' ||
        !/^[A-Z0-9]{1,16}$/.test(update.symbol || '') ||
        update.marketSymbol !== `${update.symbol}-USD` ||
        !Number.isFinite(update.price) || update.price <= 0) return false

    const subscriptionIds = this.subscriptionsFor(update.symbol)
    this.publish({
      type: 'market.data.received',
      source: { scope: 'asset', id: update.symbol },
      context: subscriptionIds.map(id => ({ scope: 'subscription', id })),
      data: {
        symbol: update.symbol, price: update.price, volume24h: update.volume24h,
        provider: update.provider, marketSymbol: update.marketSymbol,
        timestamp: update.timestamp, subscriptionIds,
      },
    })

    const key = `${update.provider}:${update.marketSymbol}`
    if (!this.seen.has(key) && !this.pending.has(key)) {
      this.pending.add(key)
      void this.ensureAsset(update).then(() => {
        this.seen.set(key, true)
        // Bound the cache; deletion only causes a harmless indexed recheck.
        if (this.seen.size > 1000) this.seen.delete(this.seen.keys().next().value)
      }).catch(error => {
        this.errors.unshift({ at: new Date().toISOString(), message: String(error.message).slice(0, 200) })
        this.errors.length = Math.min(this.errors.length, 10)
      }).finally(() => this.pending.delete(key))
    }
    return true
  }

  getState() {
    return { registeredMarkets: this.seen.size, pendingRegistrations: this.pending.size, errors: [...this.errors] }
  }
}

export const marketIngestion = new MarketIngestion()
