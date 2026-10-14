import mongoose from 'mongoose'

const membershipSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
  preferences: {
    provider: { type: String, trim: true, lowercase: true, default: '' },
    exchange: { type: String, trim: true, lowercase: true, default: '' },
    marketSymbol: { type: String, trim: true, uppercase: true, default: '' },
    priority: { type: Number, min: 0, max: 100, default: 50 },
    notes: { type: String, maxlength: 500, default: '' },
  },
}, { timestamps: true })

membershipSchema.index({ asset: 1, collection: 1 }, { unique: true })
export default mongoose.model('Membership', membershipSchema)
