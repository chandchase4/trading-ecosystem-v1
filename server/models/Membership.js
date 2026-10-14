import mongoose from 'mongoose'

const membershipSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
}, { timestamps: true })

membershipSchema.index({ asset: 1, collection: 1 }, { unique: true })

export default mongoose.model('Membership', membershipSchema)
