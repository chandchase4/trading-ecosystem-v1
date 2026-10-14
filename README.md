# Trading Ecosystem v1

A small MongoDB-backed trading workspace with **one command system** for the terminal and React. No market-data API, filters, discovery, or trading orders yet.

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
exit
```

Note: After renaming a collection, use its **new** name in subsequent commands (the example above demonstrates syntax, not a single uninterrupted script).

Asset creation is automatic when you add symbols to a collection. Symbols can be separated by commas, whitespace, or line breaks; duplicates are ignored. One command accepts at most 50 symbols.

Scanners are **configuration and in-memory asset registries only**. Scanner names and attachments persist in MongoDB, but running status is reset if the Node server restarts. There are no price updates or filters. Updating a collection refreshes active registries in the running backend.

### Developer tests

```bash
cd server
npm test
```

Unit and API tests work without your Atlas credentials. CI additionally tests MongoDB integration against a disposable MongoDB service; never run those tests against a production database.

The React frontend can be built via `cd client && npm ci && npm run build`. GitHub Actions automatically runs backend tests and builds the frontend.

See [architecture](docs/ARCHITECTURE.md) for the roadmap.
