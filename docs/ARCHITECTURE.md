# Architecture — Trading Ecosystem v1

## Goal
Build a CLI-first market scanner with reusable backend services. Keep the initial MVP small, while leaving room for a future React dashboard, automated discovery, a trading journal, analytics, and machine-learning experiments.

## Technology
- Node.js (ES modules) for CLI, commands, and scanner execution
- Express server scaffold created; no routes yet
- React + Vite minimal frontend in `client/`; frontend development is deferred
- MongoDB + Mongoose connection scaffold in `server/`; no models yet
- Market data providers to be selected; no live market data exists yet

## Initial MVP
1. CLI commands for creating, listing, and managing assets and collections.
2. Memberships connecting assets to collections.
3. Processes and subscriptions configuring which collection a scanner monitors.
4. CommandManager routing start, stop, kill, and status commands.
5. ScannerManager maintaining a deduplicated active asset registry and evaluating basic scanning rules.
6. Basic market data fetching sufficient to support the initial scanner.

Do not implement notifications, a dashboard, automatic discovery, advanced state restoration, or elaborate event infrastructure in the initial MVP.

## Core concepts
- **Asset**: instrument identity and metadata.
- **Collection**: reusable list of assets.
- **Membership**: asset-to-collection relation; unique on asset and collection.
- **Process**: reusable scanner/discovery definition with defaults.
- **Subscription**: configured process instance, target asset/collection/membership, and output collections.
- **Command**: action submitted through the CLI and dispatched to the appropriate manager.

## Manager boundaries
- **CommandManager** interprets and dispatches commands.
- **SubscriptionManager** will own subscription configuration and lifecycle as complexity grows.
- **ScannerManager** evaluates scanner subscriptions. One asset may be referenced by many subscriptions, but should appear only once in the active registry.
- **DataManager** will centralize market-data requests, caching, provider rate limits, and shared indicator calculations. Implement incrementally, after core scanning works.
- **DiscoveryManager** is a future peer of ScannerManager, not an MVP requirement.

## Scanner registry
Maintain an asset-to-subscription reference map, for example:

```js
activeAssets.get("BTC") // Set(["momentum", "breakout"])
```

Removing a subscription only removes its reference. Remove the asset from active monitoring when no active subscription requires it. Shared data acquisition should avoid redundant requests.

## Future behavior — not MVP
- Start = actively scan.
- Stop = switch to low-resource discovery mode.
- Kill = remove runtime activity while preserving configuration.
- Discovery, Normal, and Intensive monitoring modes, independently tracked per asset/subscription.
- Automatic promotions/demotions with configurable thresholds.
- DataManager acquires a shared feed at the fastest required frequency.
- Provider failover, retries, priority scheduling, notifications, structured events, undo, snapshots, and recovery.
- MongoDB-backed synchronization and event-driven updates for collection changes.

For the first CLI implementation, stop may simply pause a scanner until DiscoveryManager exists.

## Working conventions
- Keep modules small and focused, with a modular-monolith architecture.
- Do not couple scanner logic to CLI presentation or React components.
- Prefer clear contracts and working end-to-end slices over premature abstraction.
- Use `README.md` for setup and `docs/ARCHITECTURE.md` for architecture and roadmap.
- Never commit secrets or provider API keys.

## Next implementation step
Implement a minimal CLI with MongoDB models for assets, collections, and memberships; then add a small ScannerManager. React remains deferred.
