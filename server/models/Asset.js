import mongoose from 'mongoose'

const assetSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      match: /^[A-Z0-9][A-Z0-9._:/-]{0,31}$/,
    },
  },
  { timestamps: true },
)

export default mongoose.model('Asset', assetSchema)
