import { Item, Asset, ItemMutation } from '@smartnotes/shared';

const DB_NAME = 'SmartNotes_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = req.result;

        // 1. Items store (Notes & Folders)
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('parentId', 'parentId', { unique: false });
          itemStore.createIndex('kind', 'kind', { unique: false });
          itemStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          itemStore.createIndex('isDeleted', 'isDeleted', { unique: false });
        }

        // 2. Separate Assets store (Binary blobs)
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('sha256', 'sha256', { unique: false });
          assetStore.createIndex('syncState', 'syncState', { unique: false });
        }

        // 3. Durable Outbox for offline mutations
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'opId' });
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 4. Local Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Items CRUD
export async function dbGetAllItems(includeDeleted = false): Promise<Item[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as Item[];
      resolve(includeDeleted ? items : items.filter(i => !i.isDeleted));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function dbSaveItem(item: Item, queueForSync = true): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['items', 'outbox'], 'readwrite');
    const itemStore = tx.objectStore('items');
    const outboxStore = tx.objectStore('outbox');

    item.updatedAt = Date.now();
    itemStore.put(item);

    if (queueForSync) {
      const mutation: ItemMutation = {
        opId: `op-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        itemId: item.id,
        action: item.isDeleted ? 'delete' : 'upsert',
        baseVersion: item.version,
        item,
        timestamp: Date.now()
      };
      outboxStore.put(mutation);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbSaveItemsBatch(items: Item[]): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbMarkItemDeleted(id: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['items', 'outbox'], 'readwrite');
  const store = tx.objectStore('items');
  const outbox = tx.objectStore('outbox');

  const req = store.get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const item = req.result as Item;
      if (item) {
        item.isDeleted = true;
        item.deletedAt = Date.now();
        item.updatedAt = Date.now();
        store.put(item);

        outbox.put({
          opId: `op-del-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          itemId: item.id,
          action: 'delete',
          baseVersion: item.version,
          item,
          timestamp: Date.now()
        });
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// Binary Assets Storage (IndexedDB Object Store for Blob/ArrayBuffer)
export interface StoredAssetRecord {
  id: string;
  sha256: string;
  mimeType: string;
  byteLength: number;
  filename: string;
  blob: Blob;
  createdAt: number;
  syncState: 'local' | 'synced' | 'pending_upload';
}

export async function dbSaveAsset(record: StoredAssetRecord): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAsset(id: string): Promise<StoredAssetRecord | null> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readonly');
    const store = tx.objectStore('assets');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as StoredAssetRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAllAssets(): Promise<StoredAssetRecord[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readonly');
    const store = tx.objectStore('assets');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as StoredAssetRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

// Outbox Queue Management
export async function dbGetOutboxMutations(): Promise<ItemMutation[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as ItemMutation[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbRemoveOutboxMutations(opIds: string[]): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    for (const opId of opIds) {
      store.delete(opId);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Settings Key-Value
export async function dbGetSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => {
      resolve(req.result ? (req.result.value as T) : defaultValue);
    };
    req.onerror = () => resolve(defaultValue);
  });
}

export async function dbSetSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Clear all local database data
export async function dbClearAllData(): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['items', 'assets', 'outbox', 'settings'], 'readwrite');
    tx.objectStore('items').clear();
    tx.objectStore('assets').clear();
    tx.objectStore('outbox').clear();
    tx.objectStore('settings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

