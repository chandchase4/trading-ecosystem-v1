import * as catalog from './services/catalog.js'
import { scanners } from './services/scanners.js'

// Read-only projection for the phone UI. All writes still go through commands.js.
export async function readWorkspaceState() {
  const [assets, collections, scannerItems] = await Promise.all([
    catalog.listAssets(),
    catalog.getWorkspaceCollections(),
    scanners.details(),
  ])
  return {
    assets,
    collections,
    scanners: scannerItems,
    registry: { uniqueAssets: scanners.registry.uniqueAssetCount },
  }
}
