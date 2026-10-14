import mongoose from 'mongoose'

const { Schema, model } = mongoose
const symbol = { type: String, required: true, uppercase: true, trim: true,
  match: /^[A-Z0-9][A-Z0-9._/-]{0,19}$/ }
const name = { type: String, required: true, trim: true, maxlength: 60 }
const id = (ref) => ({ type: Schema.Types.ObjectId, ref, required: true })

export const Asset = model('Asset', new Schema({
  symbol: { ...symbol, unique: true }, name: { type: String, default: '' },
  assetClass: { type: String, enum: ['crypto', 'stock', 'unknown'], default: 'unknown' },
  markets: [{ _id: false, provider: String, marketSymbol: String }],
}, { timestamps: true }))

// In V1, the Collection owns a small asset-ID set; no separate Membership pillar.
export const Collection = model('Collection', new Schema({
  name: { ...name, unique: true },
  assets: [{ type: Schema.Types.ObjectId, ref: 'Asset' }],
}, { timestamps: true }))

export const Process = model('Process', new Schema({
  name: { ...name, unique: true },
  kind: { type: String, enum: ['scanner', 'discovery'], default: 'scanner' },
  enabled: { type: Boolean, default: false },
  minChangePct: { type: Number, min: 0, max: 1000, default: 5 },
}, { timestamps: true }))

const subscriptionSchema = new Schema({
  process: id('Process'), collection: id('Collection'),
}, { timestamps: true })
subscriptionSchema.index({ process: 1, collection: 1 }, { unique: true })
export const Subscription = model('Subscription', subscriptionSchema)

const ruleSchema = new Schema({
  name: { ...name, unique: true },
  trigger: { type: String, required: true, match: /^[a-z][a-z0-9.]{2,64}$/ },
  enabled: { type: Boolean, default: false },
  symbol: { type: String, uppercase: true, trim: true, default: '' },
  action: { type: String, enum: ['alert.record', 'collection.add'], required: true },
  targetCollection: { type: Schema.Types.ObjectId, ref: 'Collection', default: null },
}, { timestamps: true })
ruleSchema.index({ enabled: 1, trigger: 1 })
export const EventRule = model('EventRule', ruleSchema)
