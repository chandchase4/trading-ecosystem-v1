import 'dotenv/config'
import { createApp } from './api.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { marketDataHub } from './services/MarketDataHub.js'
import { snapshotScheduler } from './services/SnapshotScheduler.js'

const port = Number(process.env.PORT) || 3001

try {
  await connectDatabase()
  console.log('Connected to MongoDB')
  snapshotScheduler.start()
  // Only Vite's local proxy and the local CLI should talk to this API.
  const server = createApp().listen(port, '127.0.0.1', () => {
    console.log(`Backend listening on http://127.0.0.1:${port}`)
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      snapshotScheduler.stop()
      marketDataHub.stop()
      server.close(async () => {
        await disconnectDatabase()
        process.exit(0)
      })
    })
  }
} catch (error) {
  console.error('Backend startup failed:', error.message)
  process.exitCode = 1
}
