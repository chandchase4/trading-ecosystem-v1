import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'

const app = express()
app.use(express.json())

const port = Number(process.env.PORT) || 3001

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI. Create server/.env from server/.env.example.')
  process.exit(1)
}

try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })

  console.log('Connected to MongoDB')
  app.listen(port, () => console.log(`Server listening on port ${port}`))
} catch (error) {
  console.error('Failed to connect to MongoDB:', error.message)
  process.exit(1)
}
