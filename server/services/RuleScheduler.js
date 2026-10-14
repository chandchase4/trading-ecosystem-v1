import Process from '../models/Process.js'
import EventRule from '../models/EventRule.js'
import { eventEngine } from './EventEngine.js'

// Scheduler emits events only; the EventEngine executes snapshot.capture.
// Each scheduled rule receives its own named tick, preventing cross-rule runs.
export class RuleScheduler {
  constructor({ rules = EventRule, processes = Process, publish = event => eventEngine.publish(event) } = {}) {
    this.rules = rules
    this.processes = processes
    this.publish = publish
    this.lastRun = new Map()
    this.timer = null
    this.busy = false
  }

  async migrateLegacySnapshots() {
    // Idempotent: never discard old saved schedules unless their rule exists.
    const old = await this.processes.find({ kind: 'snapshot' }).lean()
    for (const item of old) {
      const name = `snapshot-${item.name}`.slice(0, 40)
      const trigger = `schedule.${name}`
      await this.rules.updateOne({ name, trigger }, { $setOnInsert: {
        name, trigger, enabled: item.enabled === true,
        intervalSeconds: item.intervalSeconds || 300,
        target: { scope: 'global', id: '' },
        actions: [{ type: 'snapshot.capture', config: { type: item.config?.target || 'app-market-data' } }],
      } }, { upsert: true })
      await this.processes.deleteOne({ _id: item._id, kind: 'snapshot' })
    }
    if (old.length) eventEngine.invalidate()
    return old.length
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick().catch(error => console.error('Rule scheduler:', error.message))
    }, 5_000)
    this.timer.unref?.()
  }

  async tick(now = Date.now()) {
    if (this.busy) return
    this.busy = true
    try {
      const scheduled = await this.rules.find({ enabled: true, trigger: /^schedule\./ }).lean()
      const active = new Set()
      for (const rule of scheduled) {
        const name = rule.name
        const interval = Number(rule.intervalSeconds)
        if (!Number.isFinite(interval) || interval < 5) continue
        active.add(name)
        if (now - (this.lastRun.get(name) ?? now) < interval * 1000) {
          if (!this.lastRun.has(name)) this.lastRun.set(name, now)
          continue
        }
        this.lastRun.set(name, now)
        this.publish({ type: rule.trigger, source: { scope: 'global', id: '' },
          data: { scheduledRule: rule.name }, depth: 0 })
      }
      for (const name of this.lastRun.keys()) if (!active.has(name)) this.lastRun.delete(name)
    } finally { this.busy = false }
  }

  stop() { clearInterval(this.timer); this.timer = null }
}

export const ruleScheduler = new RuleScheduler()
