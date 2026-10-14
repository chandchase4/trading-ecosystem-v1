import mongoose from 'mongoose'

const exchangeSchema = new mongoose.Schema({
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  name: { type: String, required: true, trim: true },
  assetClasses: { type: [String], default: [] },
  timezone: { type: String, default: 'UTC' },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('Exchange', exchangeSchema)
