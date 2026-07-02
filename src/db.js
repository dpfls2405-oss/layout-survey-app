import { openDB } from 'idb'

const DB_NAME = 'layout-survey-db'
const DB_VERSION = 4

let dbPromise = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
          store.createIndex('createdAt', 'createdAt')
          store.createIndex('type', 'type')
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' })
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('items')) {
          const items = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true })
          items.createIndex('materialName', 'materialName')
          items.createIndex('partNo', 'partNo')
        }
        if (oldVersion < 3) {
          const items = transaction.objectStore('items')
          if (!items.indexNames.contains('modelName')) {
            items.createIndex('modelName', 'modelName')
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('distances')) {
            const dist = db.createObjectStore('distances', { keyPath: 'routeKey' })
            dist.createIndex('fromArea', 'fromArea')
            dist.createIndex('toArea', 'toArea')
          }
        }
      }
    })
  }
  return dbPromise
}

export async function saveRecord(data) {
  const db = await getDb()
  const record = { ...data, createdAt: new Date().toISOString() }
  const id = await db.add('records', record)
  return { ...record, id }
}

export async function getAllRecords() {
  const db = await getDb()
  return db.getAll('records')
}

export async function deleteRecord(id) {
  const db = await getDb()
  return db.delete('records', id)
}

export async function savePhoto(id, blob) {
  const db = await getDb()
  return db.put('photos', { id, blob, savedAt: new Date().toISOString() })
}

export async function getPhoto(id) {
  const db = await getDb()
  const row = await db.get('photos', id)
  return row ? row.blob : null
}

export async function exportAllData() {
  const db = await getDb()
  const records = await db.getAll('records')
  return JSON.stringify(records, null, 2)
}

// ──────────────── 품목 마스터 (BOM) ────────────────

export async function getAllItems() {
  const db = await getDb()
  return db.getAll('items')
}

export async function deleteItem(id) {
  const db = await getDb()
  return db.delete('items', id)
}

export async function upsertItemsForModel(modelName, items) {
  const db = await getDb()
  const tx = db.transaction('items', 'readwrite')
  const existingIds = await tx.store.index('modelName').getAllKeys(modelName)
  for (const id of existingIds) {
    await tx.store.delete(id)
  }
  const now = new Date().toISOString()
  for (const item of items) {
    await tx.store.add({ ...item, modelName, importedAt: now })
  }
  await tx.done
}

// ──────────────── 이동거리 (구간별) ────────────────

function makeRouteKey(fromArea, toArea) {
  return `${fromArea}__${toArea}`
}

export async function getAllDistances() {
  const db = await getDb()
  return db.getAll('distances')
}

export async function getDistanceMap() {
  const all = await getAllDistances()
  const map = {}
  for (const d of all) {
    map[d.routeKey] = d.distance
  }
  return map
}

export async function getDistance(fromArea, toArea) {
  const db = await getDb()
  const row = await db.get('distances', makeRouteKey(fromArea, toArea))
  return row ? row.distance : null
}

export async function upsertDistance(fromArea, toArea, distance) {
  const db = await getDb()
  const routeKey = makeRouteKey(fromArea, toArea)
  await db.put('distances', {
    routeKey,
    fromArea,
    toArea,
    distance: parseFloat(distance) || 0,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteDistance(routeKey) {
  const db = await getDb()
  return db.delete('distances', routeKey)
}
