import { Item } from './types';

/**
 * Checks whether moving `movingItemId` under `targetParentId` would create a circular dependency.
 * A cycle occurs if targetParentId is movingItemId itself, or any descendant of movingItemId.
 */
export function wouldCreateCycle(
  items: Item[],
  movingItemId: string,
  targetParentId: string | null
): boolean {
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
export function getDescendantIds(items: Item[], rootId: string): Set<string> {
  const result = new Set<string>();
  const queue = [rootId];

  const parentMap = new Map<string, string[]>();
  for (const item of items) {
    if (item.parentId && !item.isDeleted) {
      const list = parentMap.get(item.parentId) || [];
      list.push(item.id);
      parentMap.set(item.parentId, list);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
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
export function buildBreadcrumbPath(
  items: Item[],
  itemId: string | null
): Array<{ id: string | null; title: string; kind: 'root' | 'folder' | 'note' }> {
  const breadcrumb: Array<{ id: string | null; title: string; kind: 'root' | 'folder' | 'note' }> = [];
  
  if (!itemId) {
    return [{ id: null, title: 'Library', kind: 'root' }];
  }

  const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
  let current = itemMap.get(itemId);

  while (current) {
    breadcrumb.unshift({
      id: current.id,
      title: current.title || (current.kind === 'folder' ? 'Untitled Folder' : 'Untitled Note'),
      kind: current.kind
    });

    if (!current.parentId) break;
    current = itemMap.get(current.parentId);
  }

  breadcrumb.unshift({ id: null, title: 'Library', kind: 'root' });
  return breadcrumb;
}

/**
 * Computes the relative folder directory path for archive export (e.g. "Work/Projects/Architecture/").
 */
export function computeArchiveFolderPath(items: Item[], parentId: string | null): string {
  if (!parentId) return '';

  const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
  const segments: string[] = [];
  let current = itemMap.get(parentId);

  while (current) {
    const sanitizedTitle = sanitizePathSegment(current.title || 'Untitled');
    segments.unshift(sanitizedTitle);

    if (!current.parentId) break;
    current = itemMap.get(current.parentId);
  }

  return segments.length > 0 ? segments.join('/') + '/' : '';
}

/**
 * Sanitizes a title string so it is safe to use in file paths (removes invalid filesystem chars).
 */
export function sanitizePathSegment(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

