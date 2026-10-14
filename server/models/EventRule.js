import mongoose from 'mongoose'

// Rules attach to an entity through target, rather than growing event-ID
// arrays inside every Asset/Collection/Membership/Process document.
const conditionSchema = new mongoose.Schema({
  path: { type: String, required: true },
  operator: { type: String, enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'], required: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { _id: false })
const actionSchema = new mongoose.Schema({
  type: { type: String, enum: ['snapshot.capture', 'alert.record', 'collection.add'], required: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false })
const ruleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  target: {
    scope: { type: String, enum: ['global', 'asset', 'collection', 'membership', 'process', 'subscription', 'snapshot'], default: 'global' },
    id: { type: String, default: '' },
  },
  trigger: { type: String, required: true, trim: true },
  conditions: { type: [conditionSchema], default: [] },
  actions: { type: [actionSchema], default: [] },
  enabled: { type: Boolean, default: false },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true })
ruleSchema.index({ enabled: 1, trigger: 1 })
export default mongoose.model('EventRule', ruleSchema)
