import mongoose from 'mongoose'

// One canonical asset; exchange-specific USD/USDT instruments live in markets.
const marketSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, trim: true },
  base: { type: String, uppercase: true, trim: true },
  quote: { type: String, uppercase: true, trim: true },
  provider: { type: String, required: true, lowercase: true, trim: true },
  exchange: { type: String, required: true, lowercase: true, trim: true },
  activityRank: { type: Number, min: 1 },
  quoteVolume24h: { type: Number, min: 0 },
  verified: { type: Boolean, default: false },
}, { _id: false })

const assetSchema = new mongoose.Schema({
  symbol: {
    type: String, required: true, trim: true, uppercase: true, unique: true,
    match: /^[A-Z0-9][A-Z0-9._:/-]{0,31}$/,
  },
  name: { type: String, trim: true, maxlength: 120, default: '' },
  assetClass: { type: String, enum: ['stock', 'crypto', 'unknown'], default: 'unknown' },
  markets: { type: [marketSchema], default: [] },
  userData: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

export default mongoose.model('Asset', assetSchema)
