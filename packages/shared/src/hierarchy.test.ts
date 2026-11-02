import test from 'node:test';
import assert from 'node:assert';
import { wouldCreateCycle, getDescendantIds, buildBreadcrumbPath, computeArchiveFolderPath } from './hierarchy';
import { Item } from './types';
import { validateZipEntryPath, computeCRC32 } from './archive';
import { checkItemConflict, mergeConflictingNotes } from './conflict';

test('Hierarchy: Cycle prevention detects self and indirect descendants', () => {
  const items: Item[] = [
    { id: 'f1', kind: 'folder', parentId: null, title: 'Folder 1', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
    { id: 'f2', kind: 'folder', parentId: 'f1', title: 'Subfolder 2', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
    { id: 'n1', kind: 'note', parentId: 'f2', title: 'Note 1', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
    { id: 'n2', kind: 'note', parentId: 'n1', title: 'Child Note 2', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
  ];

  // Moving f1 into itself should cycle
  assert.strictEqual(wouldCreateCycle(items, 'f1', 'f1'), true);

  // Moving f1 into f2 (child) should cycle
  assert.strictEqual(wouldCreateCycle(items, 'f1', 'f2'), true);

  // Moving f1 into n2 (grandchild) should cycle
  assert.strictEqual(wouldCreateCycle(items, 'f1', 'n2'), true);

  // Moving n2 into f1 (upward) is safe (no cycle)
  assert.strictEqual(wouldCreateCycle(items, 'n2', 'f1'), false);

  // Moving to root is safe
  assert.strictEqual(wouldCreateCycle(items, 'f2', null), false);
});

test('Archive: Path validation blocks path traversal and absolute paths', () => {
  assert.strictEqual(validateZipEntryPath('normal/path/file.txt').isValid, true);
  assert.strictEqual(validateZipEntryPath('../escaped.txt').isValid, false);
  assert.strictEqual(validateZipEntryPath('sub/../../escaped.txt').isValid, false);
  assert.strictEqual(validateZipEntryPath('/etc/passwd').isValid, false);
  assert.strictEqual(validateZipEntryPath('C:\\Windows\\system32').isValid, false);
});

test('Archive: CRC32 computation works correctly', () => {
  const text = new TextEncoder().encode('Hello Smart Notes');
  const crc = computeCRC32(text);
  assert.strictEqual(typeof crc, 'number');
  assert.ok(crc > 0);
});

test('Conflict: Detects concurrent modifications to note content', () => {
  const serverItem: Item = {
    id: 'n1', kind: 'note', parentId: null, title: 'Spec', contentHtml: '<p>Server version</p>',
    isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 100, updatedAt: 200, version: 2,
    assetIds: [], mediaAnnotations: []
  };

  const clientItem: Item = {
    ...serverItem,
    contentHtml: '<p>Client offline edits</p>',
    updatedAt: 250,
    version: 1 // baseVersion was 1, but server is at 2!
  };

  const conflict = checkItemConflict(clientItem, 1, serverItem);
  assert.ok(conflict !== null);
  assert.strictEqual(conflict?.conflictType, 'concurrent_edit');

  const merged = mergeConflictingNotes(clientItem, serverItem);
  assert.ok(merged.contentHtml?.includes('Your Device Version'));
  assert.ok(merged.contentHtml?.includes('Cloud / Other Device Version'));
  assert.strictEqual(merged.version, 3);
});

