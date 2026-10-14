# Trading Ecosystem v1 architecture

## Current foundation

- **Node.js / Express** is the long-running backend process, bound to localhost port 3001.
- **MongoDB / Mongoose** persists assets, collections, memberships, scanner definitions, and scanner-to-collection attachments.
- **`server/commands.js`** is the one validated command handler, used by Express `POST /api/commands`.
- **`server/cli.js`** is a command client of that API: CLI and browser share the **same in-memory runtime state**.
- **React / Vite** provides a mobile-friendly CRUD workspace. Dev Vite proxies `/api` to localhost:3001.
- **`server/workspace.js`** projects read-only dashboard data via `GET /api/state`; no second UI-specific mutation implementation.
- **ScannerRegistry** stores one asset per symbol with a set of active subscription references. The server process owns it.
- Node unit, API, and MongoDB integration tests run under GitHub Actions.

## Current scope

- Manually create, list, rename and delete assets/collections/scanners, and manage memberships and subscriptions.
- Add multiple ticker symbols with comma or whitespace separators.
- Start, stop, and synchronize scanner registries. No polling, market data, strategy filters, alerts, discovery, orders, or trading.
- Configurations survive restart, but the active scanner registry does **not**.

## Logical data model

- **Asset:** global symbol identity.
- **Collection:** a named list of assets.
- **Membership:** unique Asset + Collection relationship.
- **Process:** named scanner configuration.
- **Subscription:** unique Process + Collection relationship.

Deleting a collection removes its memberships and scanner attachments, but does not delete the underlying assets. Deleting an asset removes its memberships. Deleting a scanner removes only its subscriptions, not lists or assets.

## Security and hosting

- The real `server/.env` is ignored by Git; do not commit credentials.
- MongoDB access happens only server-side.
- The Express API only listens on `127.0.0.1` and is accessed from the browser through Vite's dev proxy.
- Keep Codespaces forwarded port 5173 private.
- GitHub Pages only serves static React; it has **no live backend**. A properly hosted authenticated backend is a separate future deployment decision.
- HTTP command input is restricted to our command grammar. Never expose a shell or accept arbitrary JavaScript through the command route.

## Later stages (not yet implemented)

1. Provider adapters for stocks and crypto (provider reliability and feed coverage to be selected).
2. Shared feed and data caching, deduplicated by asset and interval.
3. Rule evaluation and scanner filters.
4. More sophisticated lifecycle and monitoring modes.
5. Discovery, notifications, history, analytics, and eventual portfolio modules.

Keep each stage small and verified end-to-end rather than adding untested infrastructure.
