import mongoose from 'mongoose'

const providerSchema = new mongoose.Schema({
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  name: { type: String, required: true, trim: true },
  assetClasses: { type: [String], default: [] },
  capabilities: { type: [String], default: [] },
  settings: {
    enabled: { type: Boolean, default: false },
    priority: { type: Number, default: 100 },
    preferredFeed: { type: String, default: '' },
  },
  // Secrets belong in the server environment, never the database or browser.
  isDemo: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('Provider', providerSchema)
