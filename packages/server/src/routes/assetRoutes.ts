import { Request, Response, Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { dbService, UPLOADS_DIR } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';
import { Asset } from '@smartnotes/shared';

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, UPLOADS_DIR),
  filename: (_req: any, file: any, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per asset
});

// Upload asset (image, PDF, attachment)
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const userId = req.user!.id;
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const assetId = req.body.id || `asset-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const filename = req.file.originalname || 'document';
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const byteLength = req.file.size;
    const now = Date.now();

    await dbService.run(
      `INSERT INTO assets (id, user_id, sha256, mime_type, byte_length, filename, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id, user_id) DO UPDATE SET
         sha256 = excluded.sha256,
         mime_type = excluded.mime_type,
         byte_length = excluded.byte_length,
         filename = excluded.filename,
         storage_path = excluded.storage_path`,
      [assetId, userId, sha256, mimeType, byteLength, filename, filePath, now]
    );

    const asset: Asset = {
      id: assetId,
      sha256,
      mimeType,
      byteLength,
      filename,
      createdAt: now,
      syncState: 'synced'
    };

    res.status(201).json({ asset });
  } catch (err: any) {
    res.status(500).json({ error: 'Asset upload failed: ' + err.message });
  }
});

// Download asset binary stream
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const assetId = req.params.id;

    const assetRow = await dbService.get(
      'SELECT * FROM assets WHERE id = ? AND user_id = ?',
      [assetId, userId]
    );

    if (!assetRow) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    if (!fs.existsSync(assetRow.storage_path)) {
      res.status(404).json({ error: 'Asset file missing from server storage' });
      return;
    }

    res.setHeader('Content-Type', assetRow.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(assetRow.filename)}"`);
    res.sendFile(assetRow.storage_path);
  } catch (err: any) {
    res.status(500).json({ error: 'Asset download failed: ' + err.message });
  }
});

export default router;
