import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateArchiveManifest, validateZipEntryPath, sanitizePathSegment } from '@smartnotes/shared';

describe('Client Archive & Migration Utilities', () => {
  it('Sanitizes illegal path segments across platforms', () => {
    assert.strictEqual(sanitizePathSegment('Valid-Name'), 'Valid-Name');
    assert.strictEqual(sanitizePathSegment('Invalid/Slash\\Backslash:Colon'), 'Invalid_Slash_Backslash_Colon');
    assert.strictEqual(sanitizePathSegment('   Trimmed Spaces   '), 'Trimmed Spaces');
  });

  it('Validates v2.0.0 Archive Manifest schema', () => {
    const validManifest = {
      manifestVersion: '2.0.0',
      exportedAt: Date.now(),
      appVersion: '1.0.0',
      totalItems: 2,
      totalAssets: 1,
      items: [
        {
          id: 'note-1',
          kind: 'note',
          parentId: null,
          title: 'Test Note',
          archivePath: 'notes/note-1.md',
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          isPinned: false,
          orderIndex: 0,
          assetIds: ['asset-1'],
          mediaAnnotations: []
        }
      ],
      assets: [
        {
          id: 'asset-1',
          archivePath: 'assets/asset-1.png',
          sha256: 'abc1234567890abcdef',
          mimeType: 'image/png',
          byteLength: 1024,
          filename: 'diagram.png',
          createdAt: Date.now()
        }
      ]
    };

    const result = validateArchiveManifest(validManifest);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('Rejects invalid or legacy manifest versions', () => {
    const legacyManifest = {
      manifestVersion: '999.0.0',
      items: []
    };
    const result = validateArchiveManifest(legacyManifest);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.length > 0);
  });

  it('Guards against zip slip path traversals during restore', () => {
    assert.strictEqual(validateZipEntryPath('../../etc/passwd').isValid, false);
    assert.strictEqual(validateZipEntryPath('..\\..\\Windows\\System32').isValid, false);
    assert.strictEqual(validateZipEntryPath('/absolute/path').isValid, false);
    assert.strictEqual(validateZipEntryPath('notes/subfolder/valid.md').isValid, true);
    assert.strictEqual(validateZipEntryPath('assets/diagram.png').isValid, true);
  });
});
