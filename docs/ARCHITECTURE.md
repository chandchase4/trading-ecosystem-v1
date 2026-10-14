# Trading Ecosystem v1 architecture

## Implemented baseline

- **Node.js / Express** remains the localhost-only command/API backend.
- **MongoDB / Mongoose** holds persistent configuration. Asset is the canonical identity; provider-specific markets are embedded and distinct by market symbol and provider/exchange. Memberships store contextual preferences.
- **Shared command handler** (`server/commands.js`) serves both the CLI and React.
- **React / Vite** offers a responsive four-tab workspace with an explicitly simulated, no-backend showcase and a true backend mode. GitHub Pages can only show the showcase.
- **ScannerRegistry** deduplicates symbols across active subscriptions. One backend instance holds shared runtime state.
- **Processes** can have kinds `scanner`, `discovery`, `snapshot`. Discovery is a schema/foundation only; scanner runtime and opt-in snapshot scheduler exist.
- **Providers and Exchanges** have configurable database models, with no credentials stored or exposed.
- **MarketDataHub** manages the public Coinbase ticker WebSocket and keeps most recent quotes in memory. Currently hardcoded supported symbols map to Coinbase USD pairs; true per-membership market routing and stock data adapters are next work.
- **MarketWindowBuffer** keeps at most one observation per second per active symbol for a rolling five-minute window. No price history in MongoDB.
- **EventEngine** evaluates configurable EventRules on typed events, including asset/member/process lifecycle, snapshot creation, test triggers, and actual 5%-window momentum crossing. Actions are explicitly whitelisted (`snapshot.capture`, `alert.record`, `collection.add`). A queued EventEmitter bus keeps rule evaluation off the immediate WebSocket callback.
- **SnapshotManager** captures generic typed envelopes in bounded RAM (2 MB / 120 items, oldest unpinned eviction). Individual snapshots can be exported via the HTTP route and browser download. **Persistent history is off.** Scheduler only runs enabled snapshot processes and reads cached state every configured interval.

## Entity relationships

- **Assets**: one canonical symbol. Markets contain `symbol, base, quote, provider, exchange, activityRank`, and verification flag. Names/class and personal annotations are optional.
- **Collections** group assets.
- **Memberships** are unique Asset + Collection, with `preferences.provider / exchange / marketSymbol / priority / notes`.
- **Processes** identify a workload type and runtime configuration.
- **Subscriptions** associate Process + Collection; the existing scanner registry uses this relationship.
- **EventRules** reference a target by scope and ID, describe a typed trigger, typed conditions, ordered actions; disabled by default unless specifically enabled.
- **Snapshots** define the optional future persistence model; runtime snapshots use a generic `type/source/capturedAt/payload` envelope. They are not automatically written to MongoDB.
- **Events** are runtime messages and a bounded recent activity view; a durable EventLog is future work.

## Status boundaries and safeguards

- No orders, execution, permanent trading history, auto-discovery, or stock-market consolidated tape feeds.
- Demo mode never writes to MongoDB. `demo seed` is a separate explicit command for creating sample records, and `demo trigger` emits a marked simulated event.
- Coinbase updates originate from the public Coinbase exchange and may be unavailable or stale; the UI exposes source and timestamp. IEX or SIP equities feed would require a separate adapter and credentials; premarket is a product priority but is **not working yet**.
- A real 5% market move rule fires only when the observed rolling window crosses the threshold with >=30 seconds of samples and an additional cooldown. This is a prototype momentum detector, not a finished trading signal.
- Event rule execution whitelists actions and limits snapshot memory. No arbitrary JS, shell commands, or untrusted expressions.
- Snapshot persistence and provider secrets never happen implicitly. Cloud exports and on-disk bounded history require a future implementation.
- The backend listens on `127.0.0.1`, Codespaces forwarded preview must remain **Private**. Static GitHub Pages cannot run the Node backend.
- GitHub Actions run Node tests with isolated MongoDB and build the React frontend on pull requests.

## Next priorities

1. Verify/test shared feed subscriptions and reconnect behavior with real market hours/data.
2. Build provider-specific routing from persisted Membership preferences, and Alpaca IEX authenticated equities adapter, with clear partial-coverage labels.
3. Add a UI event-rule creator/editor and permission/recursion guards, not just seed/toggle.
4. Add throttled discovery processes, provider capability/priority selection and subscription capacity management.
5. Add bounded optional persisted snapshot history/export, configurable cleanup, and selectively durable event logs.

Keep the scanner's hot path separate from persistence, alert delivery and discovery scheduling.
