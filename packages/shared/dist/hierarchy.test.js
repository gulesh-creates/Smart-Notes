"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const hierarchy_1 = require("./hierarchy");
const archive_1 = require("./archive");
const conflict_1 = require("./conflict");
(0, node_test_1.default)('Hierarchy: Cycle prevention detects self and indirect descendants', () => {
    const items = [
        { id: 'f1', kind: 'folder', parentId: null, title: 'Folder 1', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
        { id: 'f2', kind: 'folder', parentId: 'f1', title: 'Subfolder 2', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
        { id: 'n1', kind: 'note', parentId: 'f2', title: 'Note 1', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
        { id: 'n2', kind: 'note', parentId: 'n1', title: 'Child Note 2', isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 0, updatedAt: 0, version: 1, assetIds: [], mediaAnnotations: [] },
    ];
    // Moving f1 into itself should cycle
    node_assert_1.default.strictEqual((0, hierarchy_1.wouldCreateCycle)(items, 'f1', 'f1'), true);
    // Moving f1 into f2 (child) should cycle
    node_assert_1.default.strictEqual((0, hierarchy_1.wouldCreateCycle)(items, 'f1', 'f2'), true);
    // Moving f1 into n2 (grandchild) should cycle
    node_assert_1.default.strictEqual((0, hierarchy_1.wouldCreateCycle)(items, 'f1', 'n2'), true);
    // Moving n2 into f1 (upward) is safe (no cycle)
    node_assert_1.default.strictEqual((0, hierarchy_1.wouldCreateCycle)(items, 'n2', 'f1'), false);
    // Moving to root is safe
    node_assert_1.default.strictEqual((0, hierarchy_1.wouldCreateCycle)(items, 'f2', null), false);
});
(0, node_test_1.default)('Archive: Path validation blocks path traversal and absolute paths', () => {
    node_assert_1.default.strictEqual((0, archive_1.validateZipEntryPath)('normal/path/file.txt').isValid, true);
    node_assert_1.default.strictEqual((0, archive_1.validateZipEntryPath)('../escaped.txt').isValid, false);
    node_assert_1.default.strictEqual((0, archive_1.validateZipEntryPath)('sub/../../escaped.txt').isValid, false);
    node_assert_1.default.strictEqual((0, archive_1.validateZipEntryPath)('/etc/passwd').isValid, false);
    node_assert_1.default.strictEqual((0, archive_1.validateZipEntryPath)('C:\\Windows\\system32').isValid, false);
});
(0, node_test_1.default)('Archive: CRC32 computation works correctly', () => {
    const text = new TextEncoder().encode('Hello Smart Notes');
    const crc = (0, archive_1.computeCRC32)(text);
    node_assert_1.default.strictEqual(typeof crc, 'number');
    node_assert_1.default.ok(crc > 0);
});
(0, node_test_1.default)('Conflict: Detects concurrent modifications to note content', () => {
    const serverItem = {
        id: 'n1', kind: 'note', parentId: null, title: 'Spec', contentHtml: '<p>Server version</p>',
        isPinned: false, isDeleted: false, orderIndex: 0, createdAt: 100, updatedAt: 200, version: 2,
        assetIds: [], mediaAnnotations: []
    };
    const clientItem = {
        ...serverItem,
        contentHtml: '<p>Client offline edits</p>',
        updatedAt: 250,
        version: 1 // baseVersion was 1, but server is at 2!
    };
    const conflict = (0, conflict_1.checkItemConflict)(clientItem, 1, serverItem);
    node_assert_1.default.ok(conflict !== null);
    node_assert_1.default.strictEqual(conflict?.conflictType, 'concurrent_edit');
    const merged = (0, conflict_1.mergeConflictingNotes)(clientItem, serverItem);
    node_assert_1.default.ok(merged.contentHtml?.includes('Your Device Version'));
    node_assert_1.default.ok(merged.contentHtml?.includes('Cloud / Other Device Version'));
    node_assert_1.default.strictEqual(merged.version, 3);
});
