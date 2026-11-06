export type ItemKind = 'note' | 'folder';
export interface AnnotationPoint {
    x: number;
    y: number;
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
    x: number;
    y: number;
    color: string;
    fontSize?: number;
}
export interface MediaAnnotationRecord {
    assetId: string;
    pageIndex?: number;
    paths: AnnotationPath[];
    textBoxes: AnnotationTextBox[];
}
export interface NoteBlock {
    id: string;
    type: 'paragraph' | 'heading' | 'task_item' | 'bullet_list' | 'numbered_list' | 'blockquote' | 'code_block';
    level?: 1 | 2 | 3;
    checked?: boolean;
    content: string;
    meta?: Record<string, any>;
}
export interface Item {
    id: string;
    kind: ItemKind;
    parentId: string | null;
    title: string;
    color?: string;
    contentHtml?: string;
    plainText?: string;
    blocks?: NoteBlock[];
    isPinned: boolean;
    isDeleted: boolean;
    orderIndex: number;
    createdAt: number;
    updatedAt: number;
    deletedAt?: number | null;
    version: number;
    assetIds: string[];
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
export interface GitHubCredential {
    id: string;
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
    createdAt: number;
    updatedAt: number;
    userId?: string;
}
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
    daysOfWeek?: number[];
}
export interface ConsistencyActivity {
    id: string;
    categoryId: string;
    title: string;
    description?: string;
    minMinutes: number;
    idealMinutes?: number;
    recurrence: ConsistencyRecurrence;
    startDate?: string;
    endDate?: string;
    orderIndex: number;
    isPaused?: boolean;
    isArchived?: boolean;
    createdAt: number;
    updatedAt: number;
}
export interface ConsistencyDailyRecord {
    id: string;
    activityId: string;
    dateKey: string;
    isCompleted: boolean;
    completedAt?: number;
    actualMinutes: number;
    notes?: string;
    updatedAt: number;
}
export interface ConsistencyFocusSession {
    id: string;
    activityId: string;
    dateKey: string;
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
    id: string;
    activityId?: string;
    dateKey: string;
    overrideMinMinutes?: number;
    isMinimumDay?: boolean;
    reason?: string;
    createdAt: number;
}
export interface ConsistencyReflection {
    id: string;
    weekKey: string;
    wentWell: string;
    interrupted: string;
    improveNext: string;
    updatedAt: number;
}
export interface ConsistencyVault {
    categories: ConsistencyCategory[];
    activities: ConsistencyActivity[];
    dailyRecords: ConsistencyDailyRecord[];
    focusSessions: ConsistencyFocusSession[];
    overrides: ConsistencyDailyOverride[];
    reflections: ConsistencyReflection[];
    updatedAt: number;
}
