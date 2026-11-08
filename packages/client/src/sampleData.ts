import { Item } from '@smartnotes/shared';
import { StoredAssetRecord } from './storage/db';

export const SAMPLE_ITEM_IDS = new Set([
  'f-engineering',
  'f-storage-sync',
  'n-offline-sync',
  'n-delta-tracking',
  'n-conflict-res',
  'f-design',
  'n-design-tokens',
  'n-media-annotation',
  'n-quick-scratchpad',
  'f-personal',
  'f-work',
  'f-archive',
  'asset-sample-img',
  'asset-sample-pdf'
]);

export const SAMPLE_TITLES = new Set([
  'Engineering & Architecture',
  'Storage & Sync Systems',
  'Offline Synchronization Strategy',
  'IndexedDB Delta Tracking',
  'Deterministic Conflict Resolution',
  'Product & Design Specifications',
  'Design Tokens & SVG Icon System',
  'Media Annotation Engine',
  'Quick Scratchpad & Ideas',
  'Personal',
  'Work Projects',
  'Kyoto Trip Notes',
  'Sample Note'
]);

/**
 * Identifies legacy prototype and initial dummy sample items so they can be
 * completely purged from the user's workspace and trash.
 */
export function isSampleOrPrototypeItem(item: { id: string; title?: string }): boolean {
  if (SAMPLE_ITEM_IDS.has(item.id)) return true;
  if (item.title && SAMPLE_TITLES.has(item.title.trim())) return true;
  return false;
}

/**
 * Returns empty array so no default sample assets are ever seeded.
 */
export function createInitialSampleAssets(): StoredAssetRecord[] {
  return [];
}

/**
 * Empty array so no dummy notes or folders are ever seeded automatically.
 */
export const INITIAL_SAMPLE_ITEMS: Item[] = [];
