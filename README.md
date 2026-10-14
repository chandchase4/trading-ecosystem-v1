# Trading Ecosystem v1

Minimal MERN project scaffold. No scanners, routes, MongoDB models, or market data yet.

## Backend (Node.js, Express, MongoDB)

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` with a **new** MongoDB Atlas database user password and your Atlas connection string. Never commit credentials. Ensure your Atlas database user and network access allow the connection.

```bash
npm run dev
```

Or use `npm start` without watch mode. The server connects to MongoDB on startup and listens on port 3001 by default. No HTTP routes have been added.

Dependencies: Express, Mongoose, MongoDB Node.js driver, BSON, and dotenv. Mongoose already includes the MongoDB driver/BSON internally; they are also direct dependencies for future use.

## Frontend (React + Vite)

```bash
cd client
npm ci
npm run dev
```

The frontend is deliberately a bare placeholder. GitHub Pages only serves the static frontend; it cannot run the Node.js server.

See [architecture](docs/ARCHITECTURE.md) for future plans.
