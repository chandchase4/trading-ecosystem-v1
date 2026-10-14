import { MarketIngestion, marketIngestion } from './MarketIngestion.js'
import { coinbaseRestProvider } from './CoinbaseRestProvider.js'
import { marketDataHub } from './MarketDataHub.js'
import { eventEngine } from './EventEngine.js'
import { scanners } from './scanners.js'

// Single ingress for provider data and ownership of provider transports.
// Processes consume normalized data; provider callbacks never write to Mongo directly.
export class DataManager {
  constructor({ ingestion = marketIngestion, rest = coinbaseRestProvider, stream = marketDataHub,
    getSubscriptions = symbol => scanners.registry.referencesFor(symbol) } = {}) {
    this.ingestion = ingestion
    this.rest = rest
    this.stream = stream
    this.getSubscriptions = getSubscriptions
  }

  start() {
    this.ingestion.subscriptionsFor = symbol => this.getSubscriptions(symbol)
    this.rest.onData = update => this.receive(update, 'rest')
    this.stream.onData = update => this.receive(update, 'websocket')
    this.stream.onMomentum = event => eventEngine.publish(event)
  }

  receive(update, transport = 'unknown') {
    return this.ingestion.receive({ ...update, transport })
  }

  async ticker(symbol) { return this.rest.ticker(symbol) }

  syncSubscriptions(symbols) { return this.stream.sync(symbols) }

  getState() {
    return { providers: { coinbase: { rest: this.rest.getState(),
      websocket: this.stream.getState().connection } }, ingestion: this.ingestion.getState() }
  }

  stop() {
    this.stream.onData = null
    this.stream.onMomentum = null
    this.rest.onData = () => {}
    this.stream.stop()
  }
}

export const dataManager = new DataManager()
