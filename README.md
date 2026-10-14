# Trading Ecosystem v1

CLI-first Node.js + MongoDB project with a minimal React/Vite frontend.

## First CLI

In GitHub Codespaces, open a **new terminal** (leave the Express dev server running in its own terminal if you want):

```bash
cd /workspaces/trading-ecosystem-v1/server
npm install
npm run cli
```

Available commands inside the CLI:

```text
help
status
asset add BTC
asset add TSLA
asset list
exit
```

- `help` works without a MongoDB connection.
- `status` checks the MongoDB connection.
- `asset add` saves an uppercase symbol to MongoDB and avoids duplicates.
- `asset list` shows saved symbols in alphabetical order.
- `exit` closes the CLI.

You can also run a command directly: `npm run cli -- asset list`.

## Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Set `MONGODB_URI` in `server/.env` to your MongoDB Atlas connection string with a **new, strong password**. The real `.env` is ignored by Git and must not be committed. If a `.env` already exists, don't overwrite it.

Run the Express server separately with `npm run dev`; it listens on port 3001 by default and has no API routes yet.

Dependencies: Express, Mongoose, MongoDB Node.js driver, BSON, and dotenv.

## Frontend (React + Vite)

```bash
cd client
npm ci
npm run dev
```

React remains a bare placeholder. GitHub Pages hosts only the static frontend, not the Node.js server.

No scanning, subscriptions, trading orders, or live market data are implemented yet. See [architecture](docs/ARCHITECTURE.md).
