# Trading Ecosystem v1

A MongoDB-backed trading workspace with **one command system** for CLI and React, a shared Coinbase public crypto WebSocket feed, reusable event rules, bounded short-lived market windows, and optional in-memory snapshots. **No trading orders.** Stocks do not have a live provider yet.

## Use it from your phone (GitHub Codespaces)

First, pull the latest changes:

```bash
git pull origin main
```

Make sure `server/.env` already contains your MongoDB Atlas connection URI. **Don't commit or share this file.** Change any credentials previously pasted into chats.

Open **two separate Codespaces terminals**:

### Terminal 1: backend API

```bash
cd /workspaces/trading-ecosystem-v1/server
npm install
npm run dev
```

Expected: `Connected to MongoDB` and `Backend listening on http://127.0.0.1:3001`.

### Terminal 2: React frontend

```bash
cd /workspaces/trading-ecosystem-v1/client
npm ci
npm run dev
```

In Codespaces, open the **Ports** tab and select **Open in Browser** for **port 5173**. On your phone this shows the React lists/scanners UI. Keep the forwarded port visibility **Private**. Vite proxies browser requests from `/api` to the local Express backend on port 3001, so the frontend never sees your MongoDB URI.

**The GitHub Pages site is static.** It displays the React interface, but cannot execute backend commands. To actually test commands, use the Codespaces **port 5173 preview**, with both processes running. Do not publicly expose the backend API.

### Demo mode and real backend mode

The React UI opens in **SHOWCASE MODE** by default. This is deliberate: the GitHub Pages site can display example assets, animated **simulated** prices, providers, scanners, snapshots and event rules without a backend. You can use **Events & snapshots → Simulate BTC +5% event** to see a fake event create a fake snapshot/alert, or export a demo snapshot as JSON.

In Codespaces, use **Backend** to switch to actual MongoDB and real feed status. To create the example records *in your own database* (explicit opt-in, no automatic data writes), open **Events & snapshots → Seed backend samples**, or run `demo seed` in the CLI. Existing populated asset metadata is not overwritten by the seed. The seed creates `demo-watchlist`, `demo-momentum`, example providers/exchanges, disabled discovery/snapshot process configurations, and two event rules.

After seeding:

```text
scanner start demo-momentum
market list
demo trigger
snapshot take
snapshot list
event rule list
event rule enable demo-on-snapshot
process list
process enable demo-snapshots
```

The backend uses the Coinbase **public ticker WebSocket** for supported cryptocurrency assets while a scanner is running; no Coinbase API key is needed. Stock symbols appear in the unsupported-feed list until we integrate an authenticated equities provider. Crypto prices are exchange-specific, not consolidated prices. Rolling change is based on the earliest observation inside the current five-minute window, so it takes time to accumulate. The demo trigger is always a **simulated** +5.2% BTC event even in Backend mode — it is **not** an actual price move. A genuine +5% crossing over an observed window can also emit the event, with a cooldown.

Snapshots are bounded in RAM to roughly **2 MB / 120 items**, oldest unpinned first. They can be manually exported as JSON from the interface. Automatic snapshot processes are **off by default**, and manually enabling a snapshot process captures only cached state, initially and at its configured interval. Snapshot persistence to MongoDB, cloud upload, stock API connections, automated discovery, and a full rules editor are **not implemented yet**.

**Important:** A configured market pair/provider preference is saved on a Membership but runtime feed routing is currently limited to Coinbase USD pairs for supported canonical crypto symbols. Full per-membership provider selection is a later stage. Neither demo metadata nor mock prices should be treated as verified market information.

### Optional Terminal 3: CLI

```bash
cd /workspaces/trading-ecosystem-v1/server
npm run cli
```

The CLI connects to the same running Express command endpoint as React. That means `scanner start` in one interface is visible as active in the other. If Express is not running, CLI commands report that the backend is unavailable instead of silently creating a separate scanner process.

## Commands

```text
help
status

asset add BTC, TSLA, NVDA
asset list
asset delete NVDA

collection create watchlist
collection list
collection add watchlist BTC, TSLA, NVDA
collection show watchlist
collection remove watchlist TSLA
collection rename watchlist favorites
collection delete favorites

scanner create momentum
scanner list
scanner show momentum
scanner rename momentum breakout
scanner attach breakout watchlist
scanner start breakout
scanner status breakout
scanner sync breakout
scanner stop breakout
scanner detach breakout watchlist
scanner delete breakout

# Market/runtime
demo seed
demo trigger
market list
snapshot take
snapshot list
event recent
event rule list
event rule enable demo-on-snapshot
event rule disable demo-on-snapshot
process list
process enable demo-snapshots
process disable demo-snapshots
exit
```

Note: After renaming a collection, use its **new** name in subsequent commands (the example above demonstrates syntax, not a single uninterrupted script).

Asset creation is automatic when you add symbols to a collection. Symbols can be separated by commas, whitespace, or line breaks; duplicates are ignored. One command accepts at most 50 symbols.

Scanner names and attachments persist in MongoDB, but running status resets if the Node server restarts. Running supported crypto scanners connect to public Coinbase tickers; **stock live feeds and scanner filters are not yet available**. Updating a collection refreshes active registries and feed subscriptions in the running backend. Snapshot/alert RAM state does not survive a backend restart.

### Developer tests

```bash
cd server
npm test
```

Unit and API tests work without your Atlas credentials. CI additionally tests MongoDB integration against a disposable MongoDB service; never run those tests against a production database.

The React frontend can be built via `cd client && npm ci && npm run build`. GitHub Actions automatically runs backend tests and builds the frontend.

See [architecture](docs/ARCHITECTURE.md) for the roadmap.
