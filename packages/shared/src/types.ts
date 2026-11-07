// Smart Notes Domain & Sync Types

export type ItemKind = 'note' | 'folder';

export interface AnnotationPoint {
  x: number; // 0.0 - 1.0 normalized
  y: number; // 0.0 - 1.0 normalized
}

export interface AnnotationPath {
  id: string;
  color: string;
  strokeWidth: number;
  points: AnnotationPoint[];
}

export interface AnnotationTextBox {
  id: string;
  text: string;
  x: number; // 0.0 - 1.0 normalized
  y: number; // 0.0 - 1.0 normalized
  color: string;
  fontSize?: number;
}

export interface MediaAnnotationRecord {
  assetId: string;
  pageIndex?: number; // 1-based page index for PDFs, or 0 for image
  paths: AnnotationPath[];
  textBoxes: AnnotationTextBox[];
}

export interface NoteBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'task_item' | 'bullet_list' | 'numbered_list' | 'blockquote' | 'code_block';
  level?: 1 | 2 | 3; // For headings
  checked?: boolean; // For task items
  content: string;   // Clean text or structured inline tags
  meta?: Record<string, any>;
}

export interface Item {
  id: string;
  kind: ItemKind;
  parentId: string | null;
  title: string;
  color?: string;         // Custom folder/note color theme
  contentHtml?: string;   // Sanitized rich HTML content
  plainText?: string;     // Searchable text index
  blocks?: NoteBlock[];   // Optional structured block AST
  isPinned: boolean;
  isDeleted: boolean;     // Tombstone for offline-first sync
  orderIndex: number;     // Sibling sort order
  createdAt: number;      // Epoch ms
  updatedAt: number;      // Epoch ms
  deletedAt?: number | null;
  version: number;        // Revision counter
  assetIds: string[];     // IDs of referenced assets
  mediaAnnotations: MediaAnnotationRecord[];
}

export interface Asset {
  id: string;
  sha256: string;
  mimeType: string;
  byteLength: number;
  filename: string;
  createdAt: number;
  syncState: 'local' | 'synced' | 'pending_upload';
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: UserAccount;
}

// Sync Protocol Models
export interface ItemMutation {
  opId: string;
  itemId: string;
  action: 'upsert' | 'delete';
  baseVersion: number;
  item: Item;
  timestamp: number;
}

export interface SyncPushRequest {
  clientId: string;
  deviceId: string;
  lastSyncedRevision: number;
  mutations: ItemMutation[];
}

export interface SyncConflict {
  itemId: string;
  clientItem: Item;
  serverItem: Item;
  conflictType: 'concurrent_edit' | 'parent_deleted';
}

export interface SyncPushResponse {
  acceptedOpIds: string[];
  conflicts: SyncConflict[];
  newServerRevision: number;
}

export interface SyncPullRequest {
  sinceRevision: number;
  limit?: number;
}

export interface SyncPullResponse {
  items: Item[];
  latestRevision: number;
  hasMore: boolean;
}

// Archive & Manifest Models
export interface ArchiveManifestAsset {
  id: string;
  filename: string;
  sha256: string;
  mimeType: string;
  byteLength: number;
  pathInArchive: string;
}

export interface ArchiveManifest {
  manifestVersion: '2.0.0';
  exportedAt: string;
  appVersion: string;
  totalItems: number;
  totalAssets: number;
  items: Item[];
  assets: ArchiveManifestAsset[];
}

// GitHub Credentials Model
export interface GitHubCredential {
  id: string;
  username: string;
  token: string;
  label?: string;
  expiresAt: number | null; // Epoch timestamp (ms), or null for no expiry
  createdAt: number;
  updatedAt: number;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number;
}

// Consistency Tracker Models
export interface ConsistencyCategory {
  id: string;
  name: string;
  description?: string;
  orderIndex: number;
  color?: string;
  isPaused?: boolean;
  isArchived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ConsistencyRecurrenceType = 'daily' | 'weekdays' | 'weekends' | 'custom';

export interface ConsistencyRecurrence {
  type: ConsistencyRecurrenceType;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface ConsistencyActivity {
  id: string;
  categoryId: string;
  title: string;
  description?: string;
  minMinutes: number;
  idealMinutes?: number;
  recurrence: ConsistencyRecurrence;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  orderIndex: number;
  isPaused?: boolean;
  isArchived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ConsistencyDailyRecord {
  id: string; // `${activityId}_${dateKey}`
  activityId: string;
  dateKey: string; // Local YYYY-MM-DD
  isCompleted: boolean;
  completedAt?: number;
  actualMinutes: number;
  notes?: string;
  updatedAt: number;
}

export interface ConsistencyFocusSession {
  id: string;
  activityId: string;
  dateKey: string; // Local YYYY-MM-DD
  startTimestamp: number;
  endTimestamp: number;
  focusedSeconds: number;
  breakSeconds: number;
  stagesCompleted: number;
  source: 'timer' | 'manual';
  notes?: string;
  createdAt: number;
}

export interface ConsistencyDailyOverride {
  id: string; // `${activityId}_${dateKey}` or `min_day_${dateKey}`
  activityId?: string; // optional if overriding all activities or specific activity
  dateKey: string; // Local YYYY-MM-DD
  overrideMinMinutes?: number;
  isMinimumDay?: boolean; // When true, sets a global minimum day scaling
  reason?: string;
  createdAt: number;
}

export interface ConsistencyReflection {
  id: string; // `reflection_${weekKey}` e.g. 2026-W45
  weekKey: string;
  wentWell: string;
  interrupted: string;
  improveNext: string;
  updatedAt: number;
}

export interface ConsistencyCalendarEvent {
  id: string;
  dateKey: string; // Local YYYY-MM-DD
  title: string;
  notes?: string;
  tag?: string; // 'Milestone' | 'Exam' | 'Goal' | 'Reminder' | 'General'
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConsistencyVaultSettings {
  qualifyingThreshold?: number; // e.g. 40
  timerSound?: string; // 'bell' | 'gong' | 'beep' | 'arpeggio' | 'marimba'
}

export interface ConsistencyVault {
  categories: ConsistencyCategory[];
  activities: ConsistencyActivity[];
  dailyRecords: ConsistencyDailyRecord[];
  focusSessions: ConsistencyFocusSession[];
  overrides: ConsistencyDailyOverride[];
  reflections: ConsistencyReflection[];
  calendarEvents?: ConsistencyCalendarEvent[];
  settings?: ConsistencyVaultSettings;
  updatedAt: number;
}


