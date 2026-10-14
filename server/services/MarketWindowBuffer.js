// A compact five-minute rolling price window. One observation per symbol/second.
// No MongoDB writes or unbounded tick-by-tick history.
export class MarketWindowBuffer {
  constructor({ windowMs = 300_000, maxSymbols = 100, maxPoints = 360 } = {}) {
    this.windowMs = windowMs
    this.maxSymbols = maxSymbols
    this.maxPoints = maxPoints
    this.windows = new Map()
  }

  add(symbol, { price, timestamp = Date.now() }) {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) return null
    if (!this.windows.has(symbol) && this.windows.size >= this.maxSymbols) return null
    const points = this.windows.get(symbol) || []
    const cutoff = timestamp - this.windowMs
    while (points.length && points[0].timestamp < cutoff) points.shift()
    const last = points.at(-1)
    const point = { timestamp, price }
    if (last && Math.floor(last.timestamp / 1000) === Math.floor(timestamp / 1000)) {
      points[points.length - 1] = point
    } else if (!last || timestamp >= last.timestamp) {
      points.push(point)
    }
    while (points.length > this.maxPoints) points.shift()
    this.windows.set(symbol, points)
    const first = points[0]
    return {
      changeWindowPct: first && first.price > 0 ? ((price / first.price) - 1) * 100 : 0,
      observations: points.length,
      spanSeconds: first ? (timestamp - first.timestamp) / 1000 : 0,
    }
  }

  prune(activeSymbols) {
    const active = new Set(activeSymbols)
    for (const symbol of this.windows.keys()) {
      if (!active.has(symbol)) this.windows.delete(symbol)
    }
  }

  get(symbol) { return [...(this.windows.get(symbol) || [])] }
  get observationCount() {
    return [...this.windows.values()].reduce((sum, points) => sum + points.length, 0)
  }
}
