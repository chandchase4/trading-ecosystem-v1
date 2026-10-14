import mongoose from 'mongoose'

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    match: /^[a-z0-9][a-z0-9_-]{0,39}$/,
  },
}, { timestamps: true })

export default mongoose.model('Collection', collectionSchema)
