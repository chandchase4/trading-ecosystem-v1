import WebSocket from 'ws'
import { assetRegistry } from './assetRegistry.js'
import { scannerEngine } from './scannerEngine.js'
import { events } from './events.js'

// Coinbase public feeds only in V1. No secret credentials and no fake prices.
export const COINBASE_SYMBOLS = ['BTC','ETH','SOL','DOGE','ADA','AVAX','LINK','LTC','XRP']
const ALLOWED = new Set(COINBASE_SYMBOLS)
const WS_URL = 'wss://advanced-trade-ws.coinbase.com'
const validPrice = value => Number.isFinite(Number(value)) && Number(value) > 0
const sanitize = value => String(value || '').toUpperCase().trim()

export class DataManager {
  constructor({ registry = assetRegistry, engine = scannerEngine, eventBus = events,
    request = fetch, socketFactory = url => new WebSocket(url) } = {}) {
    this.registry = registry
    this.engine = engine
    this.events = eventBus
    this.request = request
    this.socketFactory = socketFactory
    this.quotes = new Map()
    this.history = new Map()
    this.active = new Set()
    this.calls = []
    this.pendingRequests = new Map()
    this.pendingRegistration = new Map()
    this.socket = null
    this.connected = 'idle'
    this.retryTimer = null
    this.closed = false
    this.error = ''
  }

  ingest(update) {
    const symbol = sanitize(update?.symbol)
    const price = Number(update?.price)
    if (update?.provider !== 'coinbase' || !ALLOWED.has(symbol) ||
      update.marketSymbol !== `${symbol}-USD` || !validPrice(price)) return false
    const time = Date.now()
    const recent = (this.history.get(symbol) || []).filter(p => time - p.time <= 300_000)
    if (!recent.length || time - recent[recent.length - 1].time >= 1000) recent.push({ time, price })
    if (recent.length > 310) recent.splice(0, recent.length - 310)
    this.history.set(symbol, recent)
    const oldest = recent[0]
    const spanSeconds = (time - oldest.time) / 1000
    const changePct = oldest.price ? ((price - oldest.price) / oldest.price) * 100 : 0
    const quote = { symbol, price, provider: 'coinbase', marketSymbol: update.marketSymbol,
      volume24h: Number.isFinite(Number(update.volume24h)) ? Number(update.volume24h) : null,
      changePct: Number(changePct.toFixed(3)), spanSeconds, timestamp: new Date(time).toISOString() }
    this.quotes.set(symbol, quote)
    const consumerIds = [...(this.engine.symbolConsumers.get(symbol) || [])]
    this.engine.ingest(quote)
    // Keep provider callback fast, but guarantee the canonical Asset exists
    // before an EventRule attempts collection.add on the first quote.
    const committed = Promise.resolve().then(() => this.registry.ensureFromData(quote))
      .then(() => this.events.publish('market.data.received', quote, { scannerIds: consumerIds }))
    this.pendingRegistration.set(symbol, committed)
    void committed.catch(error => { this.error = error.message }).finally(() => {
      if (this.pendingRegistration.get(symbol) === committed) this.pendingRegistration.delete(symbol)
    })
    return true
  }

  async pull(rawSymbol) {
    const symbol = sanitize(rawSymbol)
    if (!ALLOWED.has(symbol)) throw new Error('Coinbase V1 supports: ' + COINBASE_SYMBOLS.join(', '))
    if (this.pendingRequests.has(symbol)) return this.pendingRequests.get(symbol)
    const task = this.fetchQuote(symbol).finally(() => this.pendingRequests.delete(symbol))
    this.pendingRequests.set(symbol, task)
    return task
  }

  async fetchQuote(symbol) {
    const now = Date.now()
    this.calls = this.calls.filter(n => now - n < 60_000)
    if (this.calls.length >= 25) throw new Error('Local REST quota reached: 25 requests/minute.')
    this.calls.push(now)
    const marketSymbol = `${symbol}-USD`
    const response = await this.request(`https://api.exchange.coinbase.com/products/${marketSymbol}/ticker`,
      { headers: { Accept: 'application/json', 'User-Agent': 'TradingEcosystemMVP/1.0' },
        signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`Coinbase API returned HTTP ${response.status}`)
    const payload = await response.json()
    if (!validPrice(payload.price)) throw new Error('Coinbase returned an invalid price.')
    this.ingest({ symbol, marketSymbol, provider: 'coinbase', price: payload.price,
      volume24h: payload.volume })
    // REST callers receive confirmation only after auto-registration finishes.
    await this.pendingRegistration.get(symbol)
    return this.quotes.get(symbol)
  }

  sync(symbols) {
    this.active = new Set(symbols.filter(s => ALLOWED.has(s)))
    this.closed = false
    if (!this.active.size) { this.disconnect(); return }
    if (!this.socket) this.connect()
    else if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', channel: 'ticker',
        product_ids: [...this.active].map(s => `${s}-USD`) }))
      const remove = COINBASE_SYMBOLS.filter(s => !this.active.has(s)).map(s => `${s}-USD`)
      if (remove.length) this.socket.send(JSON.stringify({ type: 'unsubscribe', channel: 'ticker', product_ids: remove }))
    }
  }

  connect() {
    if (this.socket || this.closed || !this.active.size || process.env.TEST_MONGODB_URI) return
    this.connected = 'connecting'
    const socket = this.socketFactory(WS_URL)
    this.socket = socket
    socket.on('open', () => {
      if (socket !== this.socket) return
      this.connected = 'connected'
      this.error = ''
      socket.send(JSON.stringify({ type: 'subscribe', channel: 'ticker',
        product_ids: [...this.active].map(s => `${s}-USD`) }))
      socket.send(JSON.stringify({ type: 'subscribe', channel: 'heartbeats' }))
    })
    socket.on('message', bytes => {
      try {
        const payload = JSON.parse(String(bytes))
        if (payload.type === 'error') { this.error = payload.message || 'WebSocket provider error'; return }
        for (const item of payload.events || []) for (const ticker of item.tickers || []) {
          const symbol = String(ticker.product_id || '').replace(/-USD$/, '')
          if (this.active.has(symbol)) this.ingest({ symbol, marketSymbol: ticker.product_id,
            provider: 'coinbase', price: ticker.price, volume24h: ticker.volume_24_h })
        }
      } catch { /* Unknown provider frames are ignored. */ }
    })
    socket.on('error', error => { this.error = error.message; this.connected = 'error' })
    socket.on('close', () => {
      if (socket !== this.socket) return
      this.socket = null
      if (this.closed || !this.active.size) { this.connected = 'idle'; return }
      this.connected = 'reconnecting'
      clearTimeout(this.retryTimer)
      this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect() }, 4000)
      this.retryTimer.unref?.()
    })
  }

  disconnect() {
    clearTimeout(this.retryTimer)
    this.retryTimer = null
    const socket = this.socket
    this.socket = null
    if (socket) socket.close()
    this.connected = 'idle'
  }

  stop() { this.closed = true; this.active.clear(); this.disconnect() }

  getState() {
    return { provider: 'coinbase', websocket: this.connected, error: this.error,
      supportedSymbols: COINBASE_SYMBOLS, activeSymbols: [...this.active],
      unsupported: [...this.engine.symbolConsumers.keys()].filter(s => !ALLOWED.has(s)),
      restCallsLastMinute: this.calls.filter(n => Date.now() - n < 60_000).length, restLimit: 25,
      quotes: [...this.quotes.values()].sort((a,b) => a.symbol.localeCompare(b.symbol)) }
  }
}

export const dataManager = new DataManager()
