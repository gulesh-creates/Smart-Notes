"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wouldCreateCycle = wouldCreateCycle;
exports.getDescendantIds = getDescendantIds;
exports.buildBreadcrumbPath = buildBreadcrumbPath;
exports.computeArchiveFolderPath = computeArchiveFolderPath;
exports.sanitizePathSegment = sanitizePathSegment;
/**
 * Checks whether moving `movingItemId` under `targetParentId` would create a circular dependency.
 * A cycle occurs if targetParentId is movingItemId itself, or any descendant of movingItemId.
 */
function wouldCreateCycle(items, movingItemId, targetParentId) {
    if (!targetParentId) {
        return false; // Moving to root is always cycle-free
    }
    if (movingItemId === targetParentId) {
        return true; // Cannot move an item into itself
    }
    // Find all descendants of movingItemId
    const descendants = getDescendantIds(items, movingItemId);
    return descendants.has(targetParentId);
}
/**
 * Returns a Set of all descendant item IDs (children, grandchildren, etc.) for a given parent.
 */
function getDescendantIds(items, rootId) {
    const result = new Set();
    const queue = [rootId];
    const parentMap = new Map();
    for (const item of items) {
        if (item.parentId && !item.isDeleted) {
            const list = parentMap.get(item.parentId) || [];
            list.push(item.id);
            parentMap.set(item.parentId, list);
        }
    }
    while (queue.length > 0) {
        const currentId = queue.shift();
        const children = parentMap.get(currentId) || [];
        for (const childId of children) {
            if (!result.has(childId)) {
                result.add(childId);
                queue.push(childId);
            }
        }
    }
    return result;
}
/**
 * Builds the breadcrumb chain from root to current item.
 */
function buildBreadcrumbPath(items, itemId) {
    const breadcrumb = [];
    if (!itemId) {
        return [{ id: null, title: 'Library', kind: 'root' }];
    }
    const itemMap = new Map(items.map(i => [i.id, i]));
    let current = itemMap.get(itemId);
    while (current) {
        breadcrumb.unshift({
            id: current.id,
            title: current.title || (current.kind === 'folder' ? 'Untitled Folder' : 'Untitled Note'),
            kind: current.kind
        });
        if (!current.parentId)
            break;
        current = itemMap.get(current.parentId);
    }
    breadcrumb.unshift({ id: null, title: 'Library', kind: 'root' });
    return breadcrumb;
}
/**
 * Computes the relative folder directory path for archive export (e.g. "Work/Projects/Architecture/").
 */
function computeArchiveFolderPath(items, parentId) {
    if (!parentId)
        return '';
    const itemMap = new Map(items.map(i => [i.id, i]));
    const segments = [];
    let current = itemMap.get(parentId);
    while (current) {
        const sanitizedTitle = sanitizePathSegment(current.title || 'Untitled');
        segments.unshift(sanitizedTitle);
        if (!current.parentId)
            break;
        current = itemMap.get(current.parentId);
    }
    return segments.length > 0 ? segments.join('/') + '/' : '';
}
/**
 * Sanitizes a title string so it is safe to use in file paths (removes invalid filesystem chars).
 */
function sanitizePathSegment(name) {
    return name
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled';
}
