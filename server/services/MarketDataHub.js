import WebSocket from 'ws'
import { MarketWindowBuffer } from './MarketWindowBuffer.js'

// All consumers share one upstream connection per provider. Coinbase public
// ticker is live BTC-USD etc; equities need separate authenticated stock feed.
// No automatic demo fallback: a missing feed is shown as unavailable.
const COINBASE_URL = 'wss://advanced-trade-ws.coinbase.com'
const PAIRS = new Map([
  ['BTC', 'BTC-USD'], ['ETH', 'ETH-USD'], ['SOL', 'SOL-USD'],
  ['DOGE', 'DOGE-USD'], ['ADA', 'ADA-USD'], ['AVAX', 'AVAX-USD'],
  ['LINK', 'LINK-USD'], ['LTC', 'LTC-USD'], ['XRP', 'XRP-USD'],
])
const finitePositive = value => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export class MarketDataHub {
  constructor({ socketFactory = url => new WebSocket(url) } = {}) {
    this.socketFactory = socketFactory
    this.window = new MarketWindowBuffer()
    this.latest = new Map()
    this.active = new Set()
    this.socket = null
    this.reconnect = null
    this.retryCount = 0
    this.connection = 'idle'
    this.lastError = ''
    this.closed = false
  }

  ingest({ symbol, price, volume24h = null, provider, marketSymbol, timestamp = Date.now() }) {
    const validPrice = finitePositive(price)
    if (!validPrice || !this.active.has(symbol)) return
    const recent = this.window.add(symbol, { price: validPrice, timestamp })
    this.latest.set(symbol, {
      symbol, price: validPrice,
      volume24h: finitePositive(volume24h),
      provider, marketSymbol,
      timestamp: new Date(timestamp).toISOString(),
      changeWindowPct: recent?.changeWindowPct ?? 0,
      spanSeconds: recent?.spanSeconds ?? 0,
      mode: 'live',
    })
  }

  sync(symbols) {
    this.closed = false
    const active = new Set(symbols)
    this.active = active
    this.window.prune(active)
    for (const symbol of this.latest.keys()) {
      if (!active.has(symbol)) this.latest.delete(symbol)
    }
    const wanted = [...active].filter(symbol => PAIRS.has(symbol)).map(symbol => PAIRS.get(symbol))
    if (!wanted.length) {
      this.disconnect()
      return
    }
    if (!this.socket) this.connect()
    else if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', channel: 'ticker', product_ids: wanted }))
      const removed = [...PAIRS.values()].filter(pair => !wanted.includes(pair))
      if (removed.length) this.socket.send(JSON.stringify({ type: 'unsubscribe', channel: 'ticker', product_ids: removed }))
    }
  }

  connect() {
    // CI tests must not open public network connections.
    if (process.env.TEST_MONGODB_URI) { this.connection = 'test-disabled'; return }
    if (this.socket || this.closed) return
    this.connection = 'connecting'
    const socket = this.socketFactory(COINBASE_URL)
    this.socket = socket
    socket.on('open', () => {
      if (socket !== this.socket) return
      this.connection = 'connected'
      this.lastError = ''
      this.retryCount = 0
      const product_ids = [...this.active].filter(s => PAIRS.has(s)).map(s => PAIRS.get(s))
      if (product_ids.length) socket.send(JSON.stringify({ type: 'subscribe', channel: 'ticker', product_ids }))
    })
    socket.on('message', bytes => {
      try {
        const message = JSON.parse(String(bytes))
        for (const event of message.events || []) {
          for (const ticker of event.tickers || []) {
            const symbol = [...PAIRS].find(([,pair]) => pair === ticker.product_id)?.[0]
            if (!symbol) continue
            this.ingest({
              symbol, price: ticker.price, volume24h: ticker.volume_24_h,
              provider: 'coinbase', marketSymbol: ticker.product_id,
              timestamp: message.timestamp ? Date.parse(message.timestamp) || Date.now() : Date.now(),
            })
          }
        }
      } catch { /* Ignore invalid/unknown provider frames. */ }
    })
    socket.on('error', error => { this.lastError = error.message; this.connection = 'error' })
    socket.on('close', () => {
      if (socket !== this.socket) return
      this.socket = null
      if (this.closed || ![...this.active].some(s => PAIRS.has(s))) {
        this.connection = 'idle'
        return
      }
      this.connection = 'reconnecting'
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.retryCount++, 5))
      this.reconnect = setTimeout(() => { this.reconnect = null; this.connect() }, delay)
      this.reconnect.unref?.()
    })
  }

  disconnect() {
    clearTimeout(this.reconnect)
    this.reconnect = null
    if (this.socket) {
      const socket = this.socket
      this.socket = null
      socket.close()
    }
    this.connection = 'idle'
  }

  stop() {
    this.closed = true
    this.active.clear()
    this.disconnect()
  }

  getState() {
    return {
      source: 'live',
      connection: this.connection,
      lastError: this.lastError,
      quotes: [...this.latest.values()].sort((a,b) => a.symbol.localeCompare(b.symbol)),
      observationCount: this.window.observationCount,
      unsupported: [...this.active].filter(symbol => !PAIRS.has(symbol)).sort(),
      subscribedMarkets: [...this.active].filter(s => PAIRS.has(s)).map(s => PAIRS.get(s)),
    }
  }
}

export const marketDataHub = new MarketDataHub()
