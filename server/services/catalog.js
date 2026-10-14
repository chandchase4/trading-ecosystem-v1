import { connectDatabase } from '../db.js'
import { normalizeSymbol, normalizeName } from '../lib/validation.js'
import Asset from '../models/Asset.js'
import Collection from '../models/Collection.js'
import Membership from '../models/Membership.js'

function isDuplicate(error) {
  return error?.code === 11000
}

export async function addAsset(input) {
  const symbol = normalizeSymbol(input)
  await connectDatabase()
  await Asset.init()

  try {
    await Asset.create({ symbol })
    return { symbol, created: true }
  } catch (error) {
    if (isDuplicate(error)) return { symbol, created: false }
    throw error
  }
}

export async function listAssets() {
  await connectDatabase()
  const assets = await Asset.find().sort({ symbol: 1 }).select('symbol -_id').lean()
  return assets.map(asset => asset.symbol)
}

export async function createCollection(input) {
  const name = normalizeName(input)
  await connectDatabase()
  await Collection.init()

  try {
    await Collection.create({ name })
    return { name, created: true }
  } catch (error) {
    if (isDuplicate(error)) return { name, created: false }
    throw error
  }
}

export async function listCollections() {
  await connectDatabase()
  const collections = await Collection.find().sort({ name: 1 }).select('name -_id').lean()
  return collections.map(collection => collection.name)
}

async function getCollection(input) {
  const name = normalizeName(input)
  const collection = await Collection.findOne({ name })
  if (!collection) throw new Error(`Collection "${name}" not found. Create it first.`)
  return collection
}

async function getAsset(input) {
  const symbol = normalizeSymbol(input)
  const asset = await Asset.findOne({ symbol })
  if (!asset) throw new Error(`Asset "${symbol}" not found. Add it first.`)
  return asset
}

export async function addMember(collectionInput, symbolInput) {
  await connectDatabase()
  const collection = await getCollection(collectionInput)
  const asset = await getAsset(symbolInput)
  await Membership.init()
  try {
    const result = await Membership.updateOne(
      { collection: collection._id, asset: asset._id },
      { $setOnInsert: { collection: collection._id, asset: asset._id } },
      { upsert: true },
    )
    return { collection: collection.name, symbol: asset.symbol, added: result.upsertedCount === 1 }
  } catch (error) {
    if (isDuplicate(error)) return { collection: collection.name, symbol: asset.symbol, added: false }
    throw error
  }
}

export async function removeMember(collectionInput, symbolInput) {
  await connectDatabase()
  const collection = await getCollection(collectionInput)
  const symbol = normalizeSymbol(symbolInput)
  const asset = await Asset.findOne({ symbol })
  if (!asset) return { collection: collection.name, symbol, removed: false }
  const result = await Membership.deleteOne({ collection: collection._id, asset: asset._id })
  return { collection: collection.name, symbol, removed: result.deletedCount === 1 }
}

export async function showCollection(input) {
  await connectDatabase()
  const collection = await getCollection(input)
  const memberships = await Membership.find({ collection: collection._id }).populate('asset', 'symbol').lean()
  const symbols = memberships.filter(item => item.asset).map(item => item.asset.symbol).sort()
  return { name: collection.name, symbols }
}
