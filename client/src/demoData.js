// Front-end-only showcase for GitHub Pages and disconnected workspaces.
// Everything returned here is SIMULATED, never provider data or persisted trades.
const asset = (symbol, name, assetClass, markets, userData = {}) => ({
  id: 'demo-' + symbol, symbol, name, assetClass, markets, userData,
})
export const demoAssets = [
  asset('BTC', 'Bitcoin', 'crypto', [
    { symbol: 'BTC-USD', quote: 'USD', provider: 'coinbase', exchange: 'coinbase', activityRank: 1, verified: false },
    { symbol: 'BTC-USDT', quote: 'USDT', provider: 'okx', exchange: 'okx', activityRank: 2, verified: false },
  ], { note: 'Momentum watch' }),
  asset('ETH', 'Ethereum', 'crypto', [{ symbol: 'ETH-USD', quote: 'USD', provider: 'coinbase', exchange: 'coinbase', activityRank: 1, verified: false }]),
  asset('SOL', 'Solana', 'crypto', [{ symbol: 'SOL-USDT', quote: 'USDT', provider: 'okx', exchange: 'okx', activityRank: 1, verified: false }]),
  asset('TSLA', 'Tesla', 'stock', [{ symbol: 'TSLA', quote: 'USD', provider: 'alpaca', exchange: 'nasdaq', activityRank: 1, verified: false }]),
  asset('NVDA', 'NVIDIA', 'stock', [{ symbol: 'NVDA', quote: 'USD', provider: 'alpaca', exchange: 'nasdaq', activityRank: 1, verified: false }]),
]
const baseQuotes = [
  ['BTC', 68245.18, 4.82, 'coinbase', 'BTC-USD', 1234000000],
  ['ETH', 3892.46, 2.18, 'coinbase', 'ETH-USD', 640000000],
  ['SOL', 174.62, 6.14, 'okx', 'SOL-USDT', 189000000],
  ['TSLA', 248.32, -1.42, 'sample-only', 'TSLA', 0],
  ['NVDA', 139.75, 3.29, 'sample-only', 'NVDA', 0],
]
export function createDemoWorkspace(pulse = 0, extraAlerts = []) {
  return {
    assets: demoAssets.map(item => item.symbol),
    assetDetails: demoAssets,
    memberships: demoAssets.map(item => ({
      id: 'membership-' + item.symbol, asset: item.symbol, collection: 'demo-watchlist',
      preferences: { provider: item.markets[0].provider, marketSymbol: item.markets[0].symbol, priority: item.symbol === 'BTC' ? 90 : 50 },
    })),
    collections: [
      { name: 'demo-watchlist', symbols: ['BTC', 'ETH', 'SOL', 'TSLA', 'NVDA'] },
      { name: 'promoted', symbols: ['BTC', 'SOL'] },
    ],
    scanners: [
      { name: 'demo-momentum', running: true, symbols: ['BTC', 'ETH', 'SOL', 'TSLA', 'NVDA'], collections: ['demo-watchlist'] },
    ],
    registry: { uniqueAssets: 5 },
    processes: [
      { name: 'demo-momentum', kind: 'scanner', enabled: true },
      { name: 'demo-discovery', kind: 'discovery', enabled: false, intervalSeconds: 300 },
      { name: 'demo-snapshots', kind: 'snapshot', enabled: false, intervalSeconds: 300 },
    ],
    providers: [
      { slug: 'coinbase', name: 'Coinbase', assetClasses: ['crypto'], capabilities: ['websocket', 'ticker'], settings: { enabled: true, priority: 1 }, isDemo: true },
      { slug: 'alpaca', name: 'Alpaca', assetClasses: ['stock'], capabilities: ['websocket', 'rest', 'iex'], settings: { enabled: false, priority: 2 }, isDemo: true },
      { slug: 'okx', name: 'OKX', assetClasses: ['crypto'], capabilities: ['websocket', 'rest'], settings: { enabled: false, priority: 3 }, isDemo: true },
    ],
    exchanges: [
      { slug: 'coinbase', name: 'Coinbase Exchange' },
      { slug: 'okx', name: 'OKX' },
      { slug: 'nasdaq', name: 'Nasdaq' },
    ],
    eventRules: [
      { name: 'btc-5-percent', enabled: true, isDemo: true,
        trigger: 'market.momentum.detected', target: { scope: 'asset', id: 'BTC' },
        conditions: [{ path: 'data.changePct', operator: 'gte', value: 5 }],
        actions: [{ type: 'snapshot.capture' }, { type: 'alert.record' }] },
      { name: 'discovery-on-snapshot', enabled: false, isDemo: true,
        trigger: 'snapshot.created', target: { scope: 'global' },
        conditions: [{ path: 'data.sourceType', operator: 'eq', value: 'discovery' }],
        actions: [{ type: 'snapshot.capture' }] },
    ],
    market: {
      source: 'demo', connection: 'simulated', observationCount: 300, unsupported: [],
      subscribedMarkets: ['BTC-USD', 'ETH-USD', 'SOL-USDT'],
      quotes: baseQuotes.map(([symbol,price,changeWindowPct,provider,marketSymbol,volume24h],index) => ({
        symbol, price: Number((price * (1 + Math.sin(pulse * .52 + index) * .0003)).toFixed(2)),
        changeWindowPct: Number((changeWindowPct + Math.sin(pulse * .3 + index) * .05).toFixed(2)),
        marketSymbol, provider, volume24h, timestamp: new Date().toISOString(), mode: 'demo',
      })),
    },
    automation: {
      alerts: [
        ...extraAlerts,
        { id: 'example-1', message: 'SOL entered high-priority watchlist', symbol: 'SOL', event: 'membership.priority.raised', snapshotId: 'example-snap-1', at: 'Sample event', demo: true },
      ],
      recentEvents: [
        ...extraAlerts.map(item => ({ type: item.event, at: item.at, source: { scope: 'asset', id: 'BTC' } })),
        { type: 'snapshot.created', at: 'Sample event', source: { scope: 'process', id: 'demo-discovery' } },
        { type: 'membership.priority.raised', at: 'Sample event', source: { scope: 'membership', id: 'SOL' } },
      ],
      snapshots: [
        { id: 'example-snap-1', type: 'discovery-results', source: { type: 'process', id: 'demo-discovery' }, capturedAt: 'Sample capture', bytes: 5800, pinned: false },
      ],
      snapshotStorage: { totalBytes: 5800, maxBytes: 2000000, count: 1 },
    },
  }
}
