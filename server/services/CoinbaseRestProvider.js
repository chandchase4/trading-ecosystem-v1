// Coinbase Exchange public REST ticker adapter. One shared request lane avoids
// duplicate in-flight calls and enforces a conservative local request budget.
// The provider may impose additional server-side quotas.
const SUPPORTED = new Set(['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'XRP'])

export class CoinbaseRestProvider {
  constructor({ request = fetch, now = () => Date.now(), onData = () => {} } = {}) {
    this.request = request
    this.now = now
    this.onData = onData
    this.inFlight = new Map()
    this.calls = []
    this.lastCall = 0
  }

  async ticker(input) {
    const symbol = String(input || '').toUpperCase()
    if (!SUPPORTED.has(symbol)) throw new Error('Unsupported Coinbase market.')
    if (this.inFlight.has(symbol)) return this.inFlight.get(symbol)
    const job = this.fetchTicker(symbol)
    this.inFlight.set(symbol, job)
    try { return await job } finally { this.inFlight.delete(symbol) }
  }

  async fetchTicker(symbol) {
    const now = this.now()
    this.calls = this.calls.filter(at => now - at < 60_000)
    if (this.calls.length >= 30 || now - this.lastCall < 1000) {
      throw new Error('Coinbase REST local rate limit: retry after a moment.')
    }
    this.lastCall = now
    this.calls.push(now)
    const marketSymbol = `${symbol}-USD`
    const response = await this.request(
      `https://api.exchange.coinbase.com/products/${marketSymbol}/ticker`,
      { headers: { Accept: 'application/json', 'User-Agent': 'TradingEcosystemV1/0.1' }, signal: AbortSignal.timeout(7000) },
    )
    if (!response.ok) throw new Error(`Coinbase REST HTTP ${response.status}`)
    const payload = await response.json()
    const price = Number(payload.price)
    if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid Coinbase REST ticker price.')
    const volume24h = Number(payload.volume)
    const update = {
      symbol, marketSymbol, provider: 'coinbase', price,
      volume24h: Number.isFinite(volume24h) && volume24h >= 0 ? volume24h : null,
      timestamp: payload.time || new Date(this.now()).toISOString(),
    }
    this.onData(update)
    return update
  }

  getState() {
    return { provider: 'coinbase', transport: 'rest', localRequestsLastMinute: this.calls.length,
      localLimitPerMinute: 30, activeRequests: this.inFlight.size }
  }
}
export const coinbaseRestProvider = new CoinbaseRestProvider()
