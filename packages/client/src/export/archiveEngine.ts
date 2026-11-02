import JSZip from 'jszip';
import { Item, Asset, ArchiveManifest, ArchiveManifestAsset, computeArchiveFolderPath, sanitizePathSegment, validateZipEntryPath, validateArchiveManifest } from '@smartnotes/shared';
import { dbGetAllItems, dbGetAllAssets, dbSaveItem, dbSaveAsset, StoredAssetRecord } from '../storage/db';

export interface ExportProgressCallback {
  (percentage: number, statusMessage: string): void;
}

export interface RestorePreview {
  isValid: boolean;
  itemCount: number;
  noteCount: number;
  folderCount: number;
  assetCount: number;
  warnings: string[];
  manifest?: ArchiveManifest;
}

/**
 * Generates a full ZIP backup of the complete library.
 */
export async function exportLibraryToZip(onProgress?: ExportProgressCallback): Promise<{ blob: Blob; filename: string }> {
  onProgress?.(5, 'Gathering notes, folders, and assets from local database...');

  const items = await dbGetAllItems(false);
  const assets = await dbGetAllAssets();
  const zip = new JSZip();

  const manifestAssets: ArchiveManifestAsset[] = [];
  const assetsFolder = zip.folder('assets');

  onProgress?.(20, 'Archiving media documents & attachments...');

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const safeFilename = sanitizePathSegment(asset.filename);
    const archivePath = `assets/${asset.id}_${safeFilename}`;
    
    if (assetsFolder) {
      assetsFolder.file(`${asset.id}_${safeFilename}`, asset.blob);
    }

    manifestAssets.push({
      id: asset.id,
      filename: asset.filename,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
      byteLength: asset.byteLength,
      pathInArchive: archivePath
    });

    const assetProgress = 20 + Math.round((i / (assets.length || 1)) * 30);
    onProgress?.(assetProgress, `Archiving asset ${i + 1} of ${assets.length}...`);
  }

  onProgress?.(55, 'Structuring folder & child-note hierarchy...');

  // Map notes to their paths
  for (const item of items) {
    if (item.kind === 'note') {
      const folderPath = computeArchiveFolderPath(items, item.parentId);
      const safeTitle = sanitizePathSegment(item.title);
      
      const mdContent = generateMarkdownWithFrontmatter(item);
      const htmlContent = generateFormattedHtmlDoc(item);

      zip.file(`${folderPath}${safeTitle}.md`, mdContent);
      zip.file(`${folderPath}${safeTitle}.html`, htmlContent);
    }
  }

  onProgress?.(75, 'Generating version 2.0.0 manifest...');

  const manifest: ArchiveManifest = {
    manifestVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    totalItems: items.length,
    totalAssets: assets.length,
    items,
    assets: manifestAssets
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  onProgress?.(85, 'Compressing archive stream...');

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      onProgress?.(85 + Math.round(metadata.percent * 0.14), `Compressing ${Math.round(metadata.percent)}%...`);
    }
  );

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `SmartNotes-Backup-${dateStr}.zip`;

  onProgress?.(100, 'Export complete!');
  return { blob, filename };
}

/**
 * Validates and previews a ZIP backup before restoration.
 */
export async function inspectZipBackupForRestore(file: File): Promise<RestorePreview> {
  const warnings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(file);

    // 1. Path safety check across all entries
    let totalUncompressedBytes = 0;
    const MAX_UNCOMPRESSED_LIMIT = 500 * 1024 * 1024; // 500MB safety ceiling

    zip.forEach((relativePath, zipEntry) => {
      const pathCheck = validateZipEntryPath(relativePath);
      if (!pathCheck.isValid) {
        throw new Error(`Archive contains unsafe path: "${relativePath}" (${pathCheck.reason})`);
      }
      // Sum uncompressed size to protect against zip decompression bombs
      const uncomp = (zipEntry as any)._data ? (zipEntry as any)._data.uncompressedSize || 0 : 0;
      totalUncompressedBytes += uncomp;
    });

    if (totalUncompressedBytes > MAX_UNCOMPRESSED_LIMIT) {
      throw new Error(`Archive exceeds maximum safe uncompressed size limit (${Math.round(totalUncompressedBytes / 1024 / 1024)}MB)`);
    }

    // 2. Manifest check
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) {
      throw new Error('Archive is missing manifest.json');
    }

    const manifestText = await manifestEntry.async('text');
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(manifestText);
    } catch (e: any) {
      throw new Error('manifest.json is malformed JSON');
    }

    const valResult = validateArchiveManifest(parsedJson);
    if (!valResult.isValid || !valResult.manifest) {
      throw new Error(`Manifest validation failed: ${valResult.errors.join(', ')}`);
    }

    const manifest = valResult.manifest;
    const notes = manifest.items.filter(i => i.kind === 'note');
    const folders = manifest.items.filter(i => i.kind === 'folder');

    return {
      isValid: true,
      itemCount: manifest.items.length,
      noteCount: notes.length,
      folderCount: folders.length,
      assetCount: (manifest.assets || []).length,
      warnings,
      manifest
    };
  } catch (err: any) {
    return {
      isValid: false,
      itemCount: 0,
      noteCount: 0,
      folderCount: 0,
      assetCount: 0,
      warnings: [err.message || 'Unknown error inspecting ZIP backup']
    };
  }
}

/**
 * Applies a validated restore from ZIP into IndexedDB.
 */
export async function applyRestoreFromZip(file: File, manifest: ArchiveManifest, onProgress?: ExportProgressCallback): Promise<void> {
  onProgress?.(10, 'Opening archive...');
  const zip = await JSZip.loadAsync(file);

  onProgress?.(30, 'Restoring binary assets & attachments...');
  if (Array.isArray(manifest.assets)) {
    for (let i = 0; i < manifest.assets.length; i++) {
      const a = manifest.assets[i];
      const entry = zip.file(a.pathInArchive) || zip.file(`assets/${a.id}_${a.filename}`);
      if (entry) {
        const arrayBuf = await entry.async('arraybuffer');
        const blob = new Blob([arrayBuf], { type: a.mimeType || 'application/octet-stream' });
        
        const record: StoredAssetRecord = {
          id: a.id,
          sha256: a.sha256,
          mimeType: a.mimeType,
          byteLength: a.byteLength,
          filename: a.filename,
          blob,
          createdAt: Date.now(),
          syncState: 'local'
        };
        await dbSaveAsset(record);
      }
      onProgress?.(30 + Math.round((i / manifest.assets.length) * 30), `Restored asset ${i + 1} of ${manifest.assets.length}...`);
    }
  }

  onProgress?.(70, 'Restoring note & folder hierarchy...');
  for (let i = 0; i < manifest.items.length; i++) {
    const item = manifest.items[i];
    await dbSaveItem(item, true);
    onProgress?.(70 + Math.round((i / manifest.items.length) * 25), `Restored item ${i + 1} of ${manifest.items.length}...`);
  }

  onProgress?.(100, 'Restore complete!');
}

function generateMarkdownWithFrontmatter(item: Item): string {
  const frontmatter = `---
title: "${(item.title || 'Untitled').replace(/"/g, '\\"')}"
id: "${item.id}"
parentId: "${item.parentId || ''}"
kind: "${item.kind}"
createdAt: "${new Date(item.createdAt).toISOString()}"
updatedAt: "${new Date(item.updatedAt).toISOString()}"
isPinned: ${item.isPinned}
version: ${item.version}
---

`;

  const mdBody = (item.contentHtml || '')
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<[^>]*>/g, '');

  return frontmatter + mdBody;
}

function generateFormattedHtmlDoc(item: Item): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(item.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #17211a; background: #f6f7f3; }
    .note-container { background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8de; }
    h1 { color: #12241a; font-size: 2rem; margin-bottom: 8px; }
    .meta { font-size: 0.85rem; color: #637067; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e2e8de; }
    blockquote { border-left: 3px solid #b9f32a; margin: 16px 0; padding-left: 16px; color: #637067; font-style: italic; }
    code { background: #edf1e8; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="note-container">
    <h1>${escapeHtml(item.title)}</h1>
    <div class="meta">Modified: ${new Date(item.updatedAt).toLocaleString()}</div>
    <div class="body">${item.contentHtml || ''}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

