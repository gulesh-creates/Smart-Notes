import { Item } from './types';
/**
 * Checks whether moving `movingItemId` under `targetParentId` would create a circular dependency.
 * A cycle occurs if targetParentId is movingItemId itself, or any descendant of movingItemId.
 */
export declare function wouldCreateCycle(items: Item[], movingItemId: string, targetParentId: string | null): boolean;
/**
 * Returns a Set of all descendant item IDs (children, grandchildren, etc.) for a given parent.
 */
export declare function getDescendantIds(items: Item[], rootId: string): Set<string>;
/**
 * Builds the breadcrumb chain from root to current item.
 */
export declare function buildBreadcrumbPath(items: Item[], itemId: string | null): Array<{
    id: string | null;
    title: string;
    kind: 'root' | 'folder' | 'note';
}>;
/**
 * Computes the relative folder directory path for archive export (e.g. "Work/Projects/Architecture/").
 */
export declare function computeArchiveFolderPath(items: Item[], parentId: string | null): string;
/**
 * Sanitizes a title string so it is safe to use in file paths (removes invalid filesystem chars).
 */
export declare function sanitizePathSegment(name: string): string;
