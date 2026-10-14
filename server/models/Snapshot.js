import mongoose from 'mongoose'

// Persistence is opt-in; the runtime SnapshotManager uses bounded RAM by default.
const snapshotSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  source: {
    type: { type: String, required: true },
    id: { type: String, default: '' },
  },
  capturedAt: { type: Date, required: true, default: Date.now },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  pinned: { type: Boolean, default: false },
  schemaVersion: { type: Number, default: 1 },
}, { timestamps: true })
snapshotSchema.index({ capturedAt: -1 })
export default mongoose.model('Snapshot', snapshotSchema)
