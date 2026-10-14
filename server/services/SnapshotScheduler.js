import Process from '../models/Process.js'
import { scanners } from './scanners.js'
import { eventEngine } from './EventEngine.js'
import { marketDataHub } from './MarketDataHub.js'

// Disabled until a snapshot Process is enabled explicitly. Polls process
// configuration every few seconds; each enabled process captures on its cadence.
// Capture only cached data. No provider calls or permanent history writes.
export class SnapshotScheduler {
  constructor() { this.timer = null; this.lastRun = new Map(); this.busy = false }
  start() {
    if (this.timer) return
    this.timer = setInterval(() => { void this.tick().catch(error => console.error('Snapshot scheduler:', error.message)) }, 5_000)
    this.timer.unref?.()
  }
  async tick(now = Date.now()) {
    if (this.busy) return
    this.busy = true
    try {
      const processes = await Process.find({ kind: 'snapshot', enabled: true }).lean()
      for (const process of processes) {
        const id = String(process._id)
        if (now - (this.lastRun.get(id) || 0) < (process.intervalSeconds || 300) * 1000) continue
        this.lastRun.set(id, now)
        try {
          eventEngine.snapshots.capture({
            type: process.config?.target || 'app-market-data',
            source: { type: 'process', id },
            payload: { market: marketDataHub.getState(), scanners: await scanners.details() },
          })
        } catch (error) {
          console.error('Snapshot capture failed:', process.name, error.message)
        }
      }
    } finally { this.busy = false }
  }
  stop() { clearInterval(this.timer); this.timer = null }
}
export const snapshotScheduler = new SnapshotScheduler()
