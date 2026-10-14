import mongoose from 'mongoose'

const processSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    match: /^[a-z0-9][a-z0-9_-]{0,39}$/,
  },
  kind: { type: String, enum: ['scanner'], default: 'scanner', required: true },
}, { timestamps: true })

export default mongoose.model('Process', processSchema)
