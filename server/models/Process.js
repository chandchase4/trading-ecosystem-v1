import mongoose from 'mongoose'

const processSchema = new mongoose.Schema({
  name: {
    type: String, required: true, trim: true, lowercase: true, unique: true,
    match: /^[a-z0-9][a-z0-9_-]{0,39}$/,
  },
  kind: { type: String, enum: ['scanner', 'discovery'], default: 'scanner', required: true },
  enabled: { type: Boolean, default: false },
  intervalSeconds: { type: Number, min: 5, default: 300 },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

export default mongoose.model('Process', processSchema)
