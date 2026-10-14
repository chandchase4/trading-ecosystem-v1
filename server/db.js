import mongoose from 'mongoose'

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing. Create server/.env.')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
