import { ArchiveManifest } from './types';

/**
 * Validates whether an archive entry path is safe.
 * Rejects path traversal (e.g. "../", "..\"), absolute paths, null bytes, and root paths.
 */
export function validateZipEntryPath(entryPath: string): { isValid: boolean; reason?: string } {
  if (!entryPath || typeof entryPath !== 'string') {
    return { isValid: false, reason: 'Entry path cannot be empty' };
  }

  // Normalize slashes
  const normalized = entryPath.replace(/\\/g, '/');

  // Check for path traversal attempts
  if (normalized.includes('../') || normalized.includes('/..') || normalized === '..') {
    return { isValid: false, reason: 'Path traversal attempt detected (..)' };
  }

  // Check for absolute windows or unix paths
  if (/^[a-zA-Z]:/.test(normalized) || normalized.startsWith('/')) {
    return { isValid: false, reason: 'Absolute paths are forbidden' };
  }

  // Check for null bytes or control characters
  if (/[\x00-\x1f]/.test(normalized)) {
    return { isValid: false, reason: 'Control characters detected in path' };
  }

  return { isValid: true };
}

/**
 * Validates a parsed archive manifest structure.
 */
export function validateArchiveManifest(manifest: any): { isValid: boolean; manifest?: ArchiveManifest; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { isValid: false, errors: ['Manifest is not an object'] };
  }

  if (manifest.manifestVersion !== '2.0.0' && manifest.version !== '1.0') {
    errors.push(`Unsupported manifest version: ${manifest.manifestVersion || manifest.version}`);
  }

  if (!Array.isArray(manifest.items)) {
    errors.push('Manifest items property must be an array');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    manifest: manifest as ArchiveManifest,
    errors: []
  };
}

/**
 * Pure CRC32 calculation table and utility for ZIP creation and verification.
 */
const crcTable: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function computeCRC32(bytes: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

