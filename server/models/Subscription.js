import mongoose from 'mongoose'

const subscriptionSchema = new mongoose.Schema({
  process: { type: mongoose.Schema.Types.ObjectId, ref: 'Process', required: true },
  collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
}, { timestamps: true })

subscriptionSchema.index({ process: 1, collection: 1 }, { unique: true })

export default mongoose.model('Subscription', subscriptionSchema)
