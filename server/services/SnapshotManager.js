import { randomUUID } from 'node:crypto'

// Captures are disposable RAM objects unless an explicit export/persistence
// action is added. Capacity is enforced by bytes AND item count.
export class SnapshotManager {
  constructor({ maxBytes = 2_000_000, maxCount = 120, onCreated = null } = {}) {
    this.maxBytes = maxBytes
    this.maxCount = maxCount
    this.onCreated = onCreated
    this.items = []
    this.totalBytes = 0
  }

  capture({ type, source, payload, pinned = false }) {
    const snapshot = {
      id: randomUUID(), type, source, capturedAt: new Date().toISOString(),
      schemaVersion: 1, payload: structuredClone(payload), pinned,
    }
    const bytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8')
    if (bytes > this.maxBytes) throw new Error('Snapshot exceeds RAM storage limit.')
    while ((this.totalBytes + bytes > this.maxBytes || this.items.length >= this.maxCount)) {
      const index = this.items.findIndex(item => !item.pinned)
      if (index < 0) throw new Error('Snapshot storage full: only pinned items remain.')
      this.totalBytes -= this.items[index].bytes
      this.items.splice(index, 1)
    }
    const item = { ...snapshot, bytes }
    this.items.push(item)
    this.totalBytes += bytes
    this.onCreated?.(item)
    return item
  }

  list() {
    return this.items.slice().reverse().map(({ payload, ...metadata }) => metadata)
  }

  get(id) { return this.items.find(item => item.id === id) || null }
  pin(id, value = true) {
    const snapshot = this.get(id)
    if (!snapshot) throw new Error('Snapshot not found.')
    snapshot.pinned = Boolean(value)
    return snapshot
  }
  get stats() { return { totalBytes: this.totalBytes, maxBytes: this.maxBytes, count: this.items.length } }
}
