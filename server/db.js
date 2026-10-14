import 'dotenv/config'
import mongoose from 'mongoose'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI. Add your connection string to server/.env')
  }
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
  }
  return mongoose.connection
}

export async function pingDatabase() {
  const connection = await connectDatabase()
  await connection.db.admin().ping()
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
