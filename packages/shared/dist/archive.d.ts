import { ArchiveManifest } from './types';
/**
 * Validates whether an archive entry path is safe.
 * Rejects path traversal (e.g. "../", "..\"), absolute paths, null bytes, and root paths.
 */
export declare function validateZipEntryPath(entryPath: string): {
    isValid: boolean;
    reason?: string;
};
/**
 * Validates a parsed archive manifest structure.
 */
export declare function validateArchiveManifest(manifest: any): {
    isValid: boolean;
    manifest?: ArchiveManifest;
    errors: string[];
};
export declare function computeCRC32(bytes: Uint8Array): number;
