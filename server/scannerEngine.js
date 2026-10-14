import { Process, Subscription } from './models.js'
import { events } from './events.js'

export class ScannerEngine {
  constructor({ publish = (type, data, context) => events.publish(type, data, context) } = {}) {
    this.publish = publish
    this.scanners = new Map()
    this.symbolConsumers = new Map()
    this.results = new Map()
    this.lastSignal = new Map()
  }

  async reload() {
    const processes = await Process.find({ enabled: true, kind: 'scanner' }).lean()
    const subscriptions = await Subscription.find({ process: { $in: processes.map(p => p._id) } })
      .populate({ path: 'collection', populate: { path: 'assets', select: 'symbol' } }).lean()
    const next = new Map(processes.map(p => [String(p._id), {
      id: String(p._id), name: p.name, minChangePct: p.minChangePct, symbols: new Set(), subscriptions: [] }]))
    const consumers = new Map()
    for (const sub of subscriptions) {
      const scanner = next.get(String(sub.process))
      if (!scanner || !sub.collection) continue
      scanner.subscriptions.push(String(sub._id))
      for (const asset of sub.collection.assets || []) {
        if (!asset?.symbol) continue
        scanner.symbols.add(asset.symbol)
        if (!consumers.has(asset.symbol)) consumers.set(asset.symbol, new Set())
        consumers.get(asset.symbol).add(scanner.id)
      }
    }
    this.scanners = next
    this.symbolConsumers = consumers
    for (const id of this.results.keys()) if (!next.has(id)) this.results.delete(id)
    return [...consumers.keys()].sort()
  }

  ingest(quote) {
    for (const scannerId of this.symbolConsumers.get(quote.symbol) || []) {
      const scanner = this.scanners.get(scannerId)
      if (!scanner) continue
      const key = `${scannerId}:${quote.symbol}`
      const matches = quote.spanSeconds >= 30 && quote.changePct >= scanner.minChangePct
      if (!this.results.has(scannerId)) this.results.set(scannerId, new Map())
      const results = this.results.get(scannerId)
      if (!matches) { results.delete(quote.symbol); continue }
      results.set(quote.symbol, { ...quote, scannerId, scannerName: scanner.name })
      if (Date.now() - (this.lastSignal.get(key) || 0) >= 300_000) {
        this.lastSignal.set(key, Date.now())
        this.publish('scanner.match', { symbol: quote.symbol, price: quote.price,
          changePct: quote.changePct, scannerId, scannerName: scanner.name },
          { subscriptionIds: scanner.subscriptions })
      }
    }
  }

  getState() {
    return { running: [...this.scanners.values()].map(s => ({
      id: s.id, name: s.name, symbols: [...s.symbols], subscriptionIds: s.subscriptions,
      matches: [...(this.results.get(s.id)?.values() || [])].sort((a,b) => b.changePct - a.changePct) })),
      uniqueSymbols: this.symbolConsumers.size }
  }
}

export const scannerEngine = new ScannerEngine()
