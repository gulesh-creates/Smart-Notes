import { Item, Asset, MediaAnnotationRecord } from '@smartnotes/shared';
import { dbSaveItem, dbSaveAsset, StoredAssetRecord } from '../storage/db';

export interface MigrationSummary {
  foldersMigrated: number;
  notesMigrated: number;
  assetsMigrated: number;
  errors: string[];
}

/**
 * Checks if the prototype IndexedDB ('SmartNotesDB_v1') exists in the current browser.
 */
export async function detectPrototypeDatabase(): Promise<boolean> {
  if (!('databases' in indexedDB)) {
    return false;
  }
  try {
    const dbs = await indexedDB.databases();
    return dbs.some(d => d.name === 'SmartNotesDB_v1');
  } catch (e) {
    return false;
  }
}

/**
 * Migrates data directly from 'SmartNotesDB_v1' into the production 'SmartNotes_v2' database.
 * Does NOT erase prototype data.
 */
export async function migrateFromPrototypeDatabase(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    foldersMigrated: 0,
    notesMigrated: 0,
    assetsMigrated: 0,
    errors: []
  };

  return new Promise((resolve) => {
    const req = indexedDB.open('SmartNotesDB_v1', 1);

    req.onerror = () => {
      summary.errors.push('Could not open prototype database SmartNotesDB_v1');
      resolve(summary);
    };

    req.onsuccess = async () => {
      const oldDb = req.result;
      if (!oldDb.objectStoreNames.contains('items')) {
        summary.errors.push('Prototype database does not contain items store');
        oldDb.close();
        resolve(summary);
        return;
      }

      const tx = oldDb.transaction('items', 'readonly');
      const store = tx.objectStore('items');
      const getAllReq = store.getAll();

      getAllReq.onerror = () => {
        summary.errors.push('Failed to read prototype items');
        oldDb.close();
        resolve(summary);
      };

      getAllReq.onsuccess = async () => {
        const rawItems = (getAllReq.result || []) as any[];
        oldDb.close();

        for (const raw of rawItems) {
          try {
            if (raw.type === 'folder' || raw.kind === 'folder') {
              const folderItem: Item = {
                id: raw.id,
                kind: 'folder',
                parentId: raw.parentId || null,
                title: raw.title || 'Untitled Folder',
                isPinned: false,
                isDeleted: false,
                orderIndex: 0,
                createdAt: raw.createdAt || Date.now(),
                updatedAt: raw.updatedAt || Date.now(),
                version: 1,
                assetIds: [],
                mediaAnnotations: []
              };
              await dbSaveItem(folderItem, true);
              summary.foldersMigrated++;
            } else {
              // Note item: separate media binary data into assets store
              const assetIds: string[] = [];
              const mediaAnnotations: MediaAnnotationRecord[] = [];

              if (Array.isArray(raw.media)) {
                for (const m of raw.media) {
                  if (m.dataUrl && m.dataUrl.startsWith('data:')) {
                    const blob = dataUrlToBlob(m.dataUrl);
                    const sha256 = await computeBlobSha256(blob);
                    const assetId = m.id || `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                    
                    const assetRecord: StoredAssetRecord = {
                      id: assetId,
                      sha256,
                      mimeType: blob.type || 'application/octet-stream',
                      byteLength: blob.size,
                      filename: m.name || (m.type === 'pdf' ? 'document.pdf' : 'image.png'),
                      blob,
                      createdAt: Date.now(),
                      syncState: 'local'
                    };
                    await dbSaveAsset(assetRecord);
                    assetIds.push(assetId);
                    summary.assetsMigrated++;

                    // Migrate annotations
                    if (m.annotations) {
                      mediaAnnotations.push({
                        assetId,
                        pageIndex: m.type === 'pdf' ? 1 : 0,
                        paths: m.annotations.paths || [],
                        textBoxes: m.annotations.textBoxes || []
                      });
                    }
                  }
                }
              }

              const noteItem: Item = {
                id: raw.id,
                kind: 'note',
                parentId: raw.parentId || null,
                title: raw.title || 'Untitled Note',
                contentHtml: raw.content || '',
                plainText: (raw.content || '').replace(/<[^>]*>/g, '').trim(),
                isPinned: Boolean(raw.isPinned),
                isDeleted: false,
                orderIndex: 0,
                createdAt: raw.createdAt || Date.now(),
                updatedAt: raw.updatedAt || Date.now(),
                version: 1,
                assetIds,
                mediaAnnotations
              };
              await dbSaveItem(noteItem, true);
              summary.notesMigrated++;
            }
          } catch (itemErr: any) {
            summary.errors.push(`Error migrating item ${raw.id}: ${itemErr.message}`);
          }
        }

        resolve(summary);
      };
    };
  });
}

/**
 * Converts a data URL to a binary Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

/**
 * Computes SHA-256 hash of a Blob using Web Crypto API.
 */
export async function computeBlobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

