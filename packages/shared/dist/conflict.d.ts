import { Item, SyncConflict } from './types';
/**
 * Checks whether an incoming client mutation conflicts with the current server item.
 */
export declare function checkItemConflict(clientItem: Item, baseVersion: number, currentServerItem: Item | null): SyncConflict | null;
/**
 * Merges two conflicting notes by combining content with clear branch labels.
 */
export declare function mergeConflictingNotes(localNote: Item, remoteNote: Item): Item;
