import { Router, Response } from 'express';
import { dbService } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';
import { Item, SyncConflict, SyncPushResponse, SyncPullResponse, checkItemConflict } from '@smartnotes/shared';

const router = Router();
router.use(requireAuth);

// PUSH mutations from client outbox
router.post('/push', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mutations, lastSyncedRevision } = req.body;

    if (!Array.isArray(mutations)) {
      res.status(400).json({ error: 'Mutations array is required' });
      return;
    }

    const acceptedOpIds: string[] = [];
    const conflicts: SyncConflict[] = [];

    for (const mut of mutations) {
      const { opId, itemId, baseVersion, item } = mut;

      // 1. Fetch current server item
      const serverRow = await dbService.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);
      const currentServerItem: Item | null = serverRow ? rowToItem(serverRow) : null;

      // 2. Conflict check
      const conflict = checkItemConflict(item, baseVersion, currentServerItem);
      if (conflict) {
        conflicts.push(conflict);
        continue; // Do NOT overwrite server version on conflict!
      }

      // 3. Apply mutation
      const nextVersion = (currentServerItem ? currentServerItem.version : 0) + 1;
      const now = Date.now();

      await dbService.run(
        `INSERT INTO items (
          id, user_id, kind, parent_id, title, content_html, plain_text,
          is_pinned, is_deleted, order_index, created_at, updated_at, deleted_at,
          version, asset_ids_json, media_annotations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET
          kind = excluded.kind,
          parent_id = excluded.parent_id,
          title = excluded.title,
          content_html = excluded.content_html,
          plain_text = excluded.plain_text,
          is_pinned = excluded.is_pinned,
          is_deleted = excluded.is_deleted,
          order_index = excluded.order_index,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          version = excluded.version,
          asset_ids_json = excluded.asset_ids_json,
          media_annotations_json = excluded.media_annotations_json
        `,
        [
          item.id,
          userId,
          item.kind,
          item.parentId,
          item.title || 'Untitled',
          item.contentHtml || '',
          item.plainText || '',
          item.isPinned ? 1 : 0,
          item.isDeleted ? 1 : 0,
          item.orderIndex || 0,
          item.createdAt || now,
          now,
          item.isDeleted ? now : null,
          nextVersion,
          JSON.stringify(item.assetIds || []),
          JSON.stringify(item.mediaAnnotations || [])
        ]
      );

      // Record revision
      await dbService.run(
        'INSERT INTO sync_revisions (user_id, item_id, timestamp) VALUES (?, ?, ?)',
        [userId, item.id, now]
      );

      acceptedOpIds.push(opId);
    }

    // Get latest revision number
    const revRow = await dbService.get(
      'SELECT MAX(revision) as maxRev FROM sync_revisions WHERE user_id = ?',
      [userId]
    );
    const newServerRevision = revRow?.maxRev || 0;

    const response: SyncPushResponse = {
      acceptedOpIds,
      conflicts,
      newServerRevision
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: 'Sync push failed: ' + err.message });
  }
});

// PULL mutations from server
router.post('/pull', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sinceRevision } = req.body;
    const since = Number(sinceRevision) || 0;

    let itemsRows: any[];
    if (since === 0) {
      // Full sync: fetch all active and tombstoned items
      itemsRows = await dbService.all('SELECT * FROM items WHERE user_id = ?', [userId]);
    } else {
      // Delta sync: fetch items modified in revisions > since
      itemsRows = await dbService.all(
        `SELECT DISTINCT i.* FROM items i
         JOIN sync_revisions r ON i.id = r.item_id AND i.user_id = r.user_id
         WHERE i.user_id = ? AND r.revision > ?`,
        [userId, since]
      );
    }

    const items: Item[] = itemsRows.map(rowToItem);

    const revRow = await dbService.get(
      'SELECT MAX(revision) as maxRev FROM sync_revisions WHERE user_id = ?',
      [userId]
    );
    const latestRevision = revRow?.maxRev || 0;

    const response: SyncPullResponse = {
      items,
      latestRevision,
      hasMore: false
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: 'Sync pull failed: ' + err.message });
  }
});

function rowToItem(row: any): Item {
  return {
    id: row.id,
    kind: row.kind,
    parentId: row.parent_id,
    title: row.title,
    contentHtml: row.content_html,
    plainText: row.plain_text,
    isPinned: Boolean(row.is_pinned),
    isDeleted: Boolean(row.is_deleted),
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
    assetIds: JSON.parse(row.asset_ids_json || '[]'),
    mediaAnnotations: JSON.parse(row.media_annotations_json || '[]')
  };
}

export default router;

