# Trading Ecosystem V1 — Seven-pillar MVP

A small editable market workspace. **Runs in Codespaces**, not as a database-backed GitHub Pages app.

## Seven pillars
1. **Asset Registry**: shared service for canonical symbol creation and deduplication.
2. **Asset**: MongoDB records for symbol, name, class, and provider market identifiers.
3. **Collections**: named sets of saved assets.
4. **Processes**: saved scanner/discovery configurations (scanner executes; discovery is a disabled placeholder).
5. **Subscriptions**: connect a Process to a Collection. The central scanner shares upstream feeds.
6. **Events**: in-memory recent events/alerts, MongoDB-backed optional listener rules (record alert or add an asset to a collection).
7. **Data Manager**: Coinbase public REST ticker and shared WebSocket feed, plus quotas and ingestion.

### Setup
```bash
cd server
npm install
cp .env.example .env
# edit .env to use your MongoDB Atlas URI
npm run dev
```
In a second terminal:
```bash
cd client
npm install
npm run dev -- --host 0.0.0.0
```
Open Codespaces **port 5173** and keep **3001 private**. Vite proxies `/api` to the backend. Do not put your database URI in client files or commit `.env`.

### How to use
Create Assets → create a Collection → add Assets to it → create a Scanner Process → subscribe it to a Collection → start it. Open Data Manager for live feed status and manual Coinbase ticker pulls. REST pulls for the nine supported crypto symbols can also automatically register assets through the Asset Registry. Incoming prices produce `market.data.received` Events; enabled Event Rules may record an in-app alert or add a known asset to a collection.

Stock and discovery providers are **not** implemented. Scanner is a basic 5-minute percentage-change filter, not a complete volume/ranking strategy. Recent events, scanner results and quotes live in RAM; catalog and rules persist in MongoDB. Database access requires a running Codespace backend.
