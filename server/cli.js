import 'dotenv/config'
import readline from 'node:readline'
import mongoose from 'mongoose'
import Asset from './models/Asset.js'

const help = `
Trading Ecosystem CLI

  help                 Show commands
  status               Check MongoDB connection
  asset add <symbol>   Save an asset (example: asset add BTC)
  asset list           List saved assets
  exit                 Close the CLI
`

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to server/.env first.')
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
  }
}

async function runCommand(input) {
  const [command, action, argument, ...extra] = input.trim().split(/\s+/)

  if (!command) return true

  if (command === 'exit' || command === 'quit') return false

  if (command === 'help') {
    console.log(help)
    return true
  }

  if (command === 'status') {
    await connectDatabase()
    await mongoose.connection.db.admin().ping()
    console.log('MongoDB: connected')
    return true
  }

  if (command === 'asset' && action === 'add' && argument && extra.length === 0) {
    const symbol = argument.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9._:/-]{0,31}$/.test(symbol)) {
      console.log('Invalid symbol. Use letters, numbers, dots, underscores, colons, slashes, or hyphens.')
      return true
    }

    await connectDatabase()
    await Asset.init()

    const existing = await Asset.exists({ symbol })
    if (existing) {
      console.log(`${symbol} is already saved.`)
      return true
    }

    try {
      await Asset.create({ symbol })
      console.log(`Added ${symbol}.`)
    } catch (error) {
      if (error.code === 11000) {
        console.log(`${symbol} is already saved.`)
      } else {
        throw error
      }
    }
    return true
  }

  if (command === 'asset' && action === 'list' && !argument) {
    await connectDatabase()
    const assets = await Asset.find().sort({ symbol: 1 }).select('symbol -_id').lean()
    if (assets.length === 0) console.log('No assets yet. Try: asset add BTC')
    else assets.forEach((asset, index) => console.log(`${index + 1}. ${asset.symbol}`))
    return true
  }

  console.log('Unknown command. Type help to see available commands.')
  return true
}

async function main() {
  const oneShot = process.argv.slice(2)
  if (oneShot.length) {
    await runCommand(oneShot.join(' '))
    return
  }

  console.log('Trading Ecosystem CLI — type help for commands.')
  const interactive = Boolean(process.stdin.isTTY)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: interactive })
  if (interactive) {
    rl.setPrompt('trade> ')
    rl.prompt()
  }

  for await (const line of rl) {
    try {
      if (!(await runCommand(line))) break
    } catch (error) {
      console.error(`Error: ${error.message}`)
    }
    if (interactive) rl.prompt()
  }

  rl.close()
}

try {
  await main()
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
