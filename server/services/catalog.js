import { connectDatabase } from '../db.js'
import { normalizeSymbol, normalizeName } from '../lib/validation.js'
import Asset from '../models/Asset.js'
import Collection from '../models/Collection.js'
import Membership from '../models/Membership.js'
import Subscription from '../models/Subscription.js'

const isDuplicate = error => error?.code === 11000

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

export async function deleteAsset(input) {
  const symbol = normalizeSymbol(input)
  await connectDatabase()
  const asset = await Asset.findOne({ symbol })
  if (!asset) return { symbol, deleted: false }
  await Membership.deleteMany({ asset: asset._id })
  await Asset.deleteOne({ _id: asset._id })
  return { symbol, deleted: true }
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

export async function renameCollection(input, nextInput) {
  const name = normalizeName(input)
  const next = normalizeName(nextInput)
  await connectDatabase()
  const collection = await getCollection(name)
  if (name === next) return { name, next, renamed: false }
  try {
    await Collection.updateOne({ _id: collection._id }, { $set: { name: next } })
    return { name, next, renamed: true }
  } catch (error) {
    if (isDuplicate(error)) throw new Error(`Collection "${next}" already exists.`)
    throw error
  }
}

export async function deleteCollection(input) {
  const name = normalizeName(input)
  await connectDatabase()
  const collection = await Collection.findOne({ name })
  if (!collection) return { name, deleted: false }
  // Collections are configuration objects. Deleting one removes its memberships
  // and scanner attachments, but never deletes the underlying assets.
  await Subscription.deleteMany({ collection: collection._id })
  await Membership.deleteMany({ collection: collection._id })
  await Collection.deleteOne({ _id: collection._id })
  return { name, deleted: true }
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

export async function getWorkspaceCollections() {
  await connectDatabase()
  const collections = await Collection.find().sort({ name: 1 }).select('name').lean()
  const memberships = await Membership.find({
    collection: { $in: collections.map(item => item._id) },
  }).populate('asset', 'symbol').lean()
  const symbolsByCollection = new Map(collections.map(item => [String(item._id), []]))
  for (const row of memberships) {
    if (row.asset) symbolsByCollection.get(String(row.collection))?.push(row.asset.symbol)
  }
  return collections.map(item => ({
    name: item.name,
    symbols: (symbolsByCollection.get(String(item._id)) ?? []).sort(),
  }))
}
