import express from 'express'
import { execute } from './commands.js'
import { readWorkspaceState } from './workspace.js'
import { eventEngine } from './services/EventEngine.js'
import { manage } from './services/management.js'
import { coinbaseRestProvider } from './services/CoinbaseRestProvider.js'
import { marketIngestion } from './services/MarketIngestion.js'

export function createApp({ executeCommand = execute, readState = readWorkspaceState } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '8kb' }))
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'trading-ecosystem-server' })
  })

  app.get('/api/state', async (_request, response) => {
    try {
      response.json({ ok: true, state: await readState() })
    } catch (error) {
      response.status(503).json({ ok: false, error: error.message })
    }
  })

  // Explicit bounded REST quote fetch. No arbitrary URLs or symbols accepted.
  app.get('/api/providers/coinbase/ticker', async (request, response) => {
    try {
      const ticker = await coinbaseRestProvider.ticker(request.query.symbol)
      response.json({ ok: true, ticker })
    } catch (error) {
      const limited = /rate limit/.test(error.message)
      response.status(limited ? 429 : 400).json({ ok: false, error: error.message })
    }
  })

  app.get('/api/providers/status', (_request, response) => {
    response.json({ ok: true, rest: coinbaseRestProvider.getState(), ingestion: marketIngestion.getState() })
  })

  // Browser can export captures manually; this never causes persistence.
  app.get('/api/snapshots/:id', (request, response) => {
    const snapshot = eventEngine.snapshots.get(request.params.id)
    if (!snapshot) return response.status(404).json({ ok: false, error: 'Snapshot not found or already evicted.' })
    return response.json({ ok: true, snapshot })
  })

  app.post('/api/manage', async (request, response) => {
    try {
      const result = await manage(request.body)
      return response.json({ ok: true, ...result })
    } catch (error) {
      return response.status(400).json({ ok: false, error: error.message })
    }
  })

  app.post('/api/commands', async (request, response) => {
    const command = request.body?.command
    if (typeof command !== 'string' || !command.trim() || command.length > 1000) {
      return response.status(400).json({ ok: false, error: 'Supply a command string (1–1000 characters).' })
    }
    // The web API never interprets OS shell commands and never closes the server.
    if (/^\s*(?:exit|quit)\s*$/i.test(command)) {
      return response.status(400).json({ ok: false, error: 'Exit is only for the interactive terminal.' })
    }

    try {
      const result = await executeCommand(command)
      return response.json({ ok: true, ...result })
    } catch (error) {
      return response.status(400).json({ ok: false, error: error.message })
    }
  })

  app.use('/api', (_request, response) => {
    response.status(404).json({ ok: false, error: 'Unknown API endpoint.' })
  })

  app.use((error, _request, response, _next) => {
    response.status(error.status || 500).json({
      ok: false,
      error: error.status === 413 ? 'Request too large.' : error.status === 400 ? 'Invalid JSON.' : 'Unexpected request error.',
    })
  })
  return app
}
