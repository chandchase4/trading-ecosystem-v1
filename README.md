# Trading Ecosystem v1

CLI-first Node.js + MongoDB project with a minimal React/Vite frontend.

## Run the CLI in Codespaces

Open a new terminal:

```bash
git pull origin main
cd server
npm install
npm run cli
```

Commands:

```text
help
status
asset add BTC
asset add TSLA
asset list
collection create watchlist
collection list
collection add watchlist BTC
collection show watchlist
collection remove watchlist BTC
exit
```

An asset must exist before adding it to a collection. Names are case-insensitive and use letters, digits, underscores or hyphens without spaces. Assets and collection memberships persist in MongoDB.

Direct one-off commands also work: `npm run cli -- collection show watchlist`.

## Backend setup

Set `MONGODB_URI` in `server/.env`, copying `server/.env.example` if needed. **Do not overwrite an existing .env or commit it.** Rotate any credentials previously exposed in chat, and grant the Codespace access to your MongoDB Atlas cluster.

```bash
cd server
npm install
npm run dev
```

Express starts on port 3001 after MongoDB connects. No HTTP API routes yet.

To run offline automated unit tests (no Atlas credentials required): `npm test`.

## Frontend (React + Vite)

```bash
cd client
npm ci
npm run dev
```

React remains a bare placeholder. GitHub Pages hosts only the static frontend, not the Node.js server.

No live scanning, market prices, orders, or subscriptions yet. See [architecture](docs/ARCHITECTURE.md).
