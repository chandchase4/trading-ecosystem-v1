import { connectDatabase } from '../db.js'
import { normalizeName } from '../lib/validation.js'
import Collection from '../models/Collection.js'
import Membership from '../models/Membership.js'
import Process from '../models/Process.js'
import Subscription from '../models/Subscription.js'
import { ScannerRegistry } from './ScannerRegistry.js'

class ScannerService {
  constructor() {
    this.registry = new ScannerRegistry()
    this.activeProcesses = new Map()
  }

  async getProcess(input) {
    const name = normalizeName(input)
    await connectDatabase()
    const process = await Process.findOne({ name, kind: 'scanner' })
    if (!process) throw new Error(`Scanner "${name}" not found. Create it first.`)
    return process
  }

  async getCollection(input) {
    const name = normalizeName(input)
    const collection = await Collection.findOne({ name })
    if (!collection) throw new Error(`Collection "${name}" not found.`)
    return collection
  }

  async create(input) {
    const name = normalizeName(input)
    await connectDatabase()
    await Process.init()
    try {
      await Process.create({ name, kind: 'scanner' })
      return { name, created: true }
    } catch (error) {
      if (error?.code === 11000) return { name, created: false }
      throw error
    }
  }

  async list() {
    await connectDatabase()
    const docs = await Process.find({ kind: 'scanner' }).sort({ name: 1 }).select('name -_id').lean()
    return docs.map(doc => doc.name)
  }

  async attach(scannerInput, collectionInput) {
    const process = await this.getProcess(scannerInput)
    const collection = await this.getCollection(collectionInput)
    await Subscription.init()
    try {
      const result = await Subscription.updateOne(
        { process: process._id, collection: collection._id },
        { $setOnInsert: { process: process._id, collection: collection._id } },
        { upsert: true },
      )
      return { name: process.name, collection: collection.name, attached: result.upsertedCount === 1 }
    } catch (error) {
      if (error?.code === 11000) {
        return { name: process.name, collection: collection.name, attached: false }
      }
      throw error
    }
  }

  async detach(scannerInput, collectionInput) {
    const process = await this.getProcess(scannerInput)
    const collection = await this.getCollection(collectionInput)
    const subscription = await Subscription.findOne({ process: process._id, collection: collection._id })
    if (!subscription) return { name: process.name, collection: collection.name, detached: false }

    await Subscription.deleteOne({ _id: subscription._id })
    this.registry.detach(String(subscription._id))
    this.activeProcesses.get(String(process._id))?.delete(String(subscription._id))
    return { name: process.name, collection: collection.name, detached: true }
  }

  async configuredCollections(processId) {
    const docs = await Subscription.find({ process: processId }).populate('collection', 'name').lean()
    return docs.filter(doc => doc.collection)
  }

  async refresh(process) {
    const key = String(process._id)
    const subscriptions = await this.configuredCollections(process._id)
    if (subscriptions.length === 0) throw new Error('Attach a collection before starting this scanner.')

    const collectionIds = subscriptions.map(doc => doc.collection._id)
    const memberships = await Membership.find({ collection: { $in: collectionIds } }).populate('asset', 'symbol').lean()
    const byCollection = new Map(collectionIds.map(id => [String(id), []]))

    for (const membership of memberships) {
      if (!membership.asset) continue
      const symbols = byCollection.get(String(membership.collection))
      if (symbols) symbols.push(membership.asset.symbol)
    }

    const oldIds = this.activeProcesses.get(key) ?? new Set()
    const newIds = new Set(subscriptions.map(doc => String(doc._id)))
    for (const id of oldIds) {
      if (!newIds.has(id)) this.registry.detach(id)
    }

    for (const sub of subscriptions) {
      this.registry.attach(String(sub._id), byCollection.get(String(sub.collection._id)) ?? [])
    }

    this.activeProcesses.set(key, newIds)
    return {
      name: process.name,
      subscriptions: newIds.size,
      symbols: this.registry.symbolsFor(newIds),
      sharedSymbols: this.registry.uniqueAssetCount,
    }
  }

  async start(input) {
    const process = await this.getProcess(input)
    return this.refresh(process)
  }

  async sync(input) {
    const process = await this.getProcess(input)
    if (!this.activeProcesses.has(String(process._id))) {
      throw new Error('Scanner is stopped. Use scanner start first.')
    }
    return this.refresh(process)
  }

  async stop(input) {
    const process = await this.getProcess(input)
    const key = String(process._id)
    const subscriptions = this.activeProcesses.get(key)
    if (!subscriptions) return { name: process.name, stopped: false }
    for (const id of subscriptions) this.registry.detach(id)
    this.activeProcesses.delete(key)
    return { name: process.name, stopped: true }
  }

  async status(input) {
    const process = await this.getProcess(input)
    const subscriptions = await this.configuredCollections(process._id)
    const activeIds = this.activeProcesses.get(String(process._id))
    return {
      name: process.name,
      running: Boolean(activeIds),
      collections: subscriptions.map(doc => doc.collection.name).sort(),
      symbols: activeIds ? this.registry.symbolsFor(activeIds) : [],
      totalUniqueAssets: this.registry.uniqueAssetCount,
    }
  }
}

export const scanners = new ScannerService()
