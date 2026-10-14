import * as catalog from './services/catalog.js'
import { scanners } from './services/scanners.js'
import { marketDataHub } from './services/MarketDataHub.js'
import { eventEngine } from './services/EventEngine.js'
import Asset from './models/Asset.js'
import Membership from './models/Membership.js'
import Provider from './models/Provider.js'
import Exchange from './models/Exchange.js'
import Process from './models/Process.js'
import EventRule from './models/EventRule.js'

// Read-only projection for CLI + responsive React. Never expose credentials.
export async function readWorkspaceState() {
  const [assets, collections, scannerItems, assetRecords, memberships, providers, exchanges, processes, rules] = await Promise.all([
    catalog.listAssets(),
    catalog.getWorkspaceCollections(),
    scanners.details(),
    Asset.find().sort({ symbol: 1 }).select('symbol name assetClass markets userData').lean(),
    Membership.find().populate('asset', 'symbol').populate('collection', 'name').lean(),
    Provider.find().sort({ 'settings.priority': 1 }).select('slug name assetClasses capabilities settings isDemo').lean(),
    Exchange.find().sort({ name: 1 }).select('slug name assetClasses timezone isDemo').lean(),
    Process.find().sort({ name: 1 }).select('name kind enabled intervalSeconds config').lean(),
    EventRule.find().sort({ name: 1 }).select('name trigger intervalSeconds target conditions actions enabled isDemo').lean(),
  ])
  return {
    assets,
    assetDetails: assetRecords.map(item => ({
      id: String(item._id), symbol: item.symbol, name: item.name || '',
      assetClass: item.assetClass || 'unknown',
      markets: (item.markets || []).sort((a,b) => (a.activityRank || 999) - (b.activityRank || 999)),
      userData: item.userData || {},
    })),
    memberships: memberships.filter(item => item.asset && item.collection).map(item => ({
      id: String(item._id), asset: item.asset.symbol,
      collection: item.collection.name, preferences: item.preferences || {},
    })),
    collections, scanners: scannerItems,
    processes: processes.map(item => ({ name: item.name, kind: item.kind, enabled: item.enabled,
      intervalSeconds: item.intervalSeconds, config: item.config || {} })),
    providers: providers.map(item => ({ slug: item.slug, name: item.name,
      assetClasses: item.assetClasses, capabilities: item.capabilities,
      settings: item.settings, isDemo: item.isDemo })),
    exchanges: exchanges.map(item => ({ slug: item.slug, name: item.name,
      assetClasses: item.assetClasses, timezone: item.timezone, isDemo: item.isDemo })),
    eventRules: rules.map(item => ({ name: item.name, trigger: item.trigger, intervalSeconds: item.intervalSeconds, enabled: item.enabled,
      target: item.target, conditions: item.conditions, actions: item.actions, isDemo: item.isDemo })),
    registry: { uniqueAssets: scanners.registry.uniqueAssetCount },
    market: marketDataHub.getState(),
    automation: eventEngine.getState(),
  }
}
