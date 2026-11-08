import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  Firestore
} from 'firebase/firestore';
import { Item, UserAccount, GitHubCredential, ConsistencyVault } from '@smartnotes/shared';

// Firebase configuration strictly from environment variables (no hardcoded credentials!)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.trim().length > 0
);

// Initialize Firebase App only if environment variables are provided
export const app: FirebaseApp | null = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const firestore: Firestore | null = app ? getFirestore(app) : null;

// Initialize Analytics if supported in this environment
if (typeof window !== 'undefined' && app) {
  isAnalyticsSupported().then(supported => {
    if (supported && app) {
      getAnalytics(app);
    }
  }).catch(() => {
    // Analytics optional in offline or test environments
  });
}

export const AUTHORIZED_EMAIL = 'gulesh.patel.csit@gmail.com';

/**
 * Signs in using Google Popup and enforces that only gulesh.patel.csit@gmail.com
 * is allowed to access the Smart Notes vault.
 */
export async function firebaseGoogleSignIn(): Promise<UserAccount> {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;
  const email = (user.email || '').toLowerCase().trim();

  if (email !== AUTHORIZED_EMAIL.toLowerCase()) {
    await signOut(auth);
    throw new Error(`Access Denied: Only ${AUTHORIZED_EMAIL} is authorized to access this Smart Notes workspace.`);
  }

  return {
    id: user.uid,
    email: user.email || AUTHORIZED_EMAIL,
    displayName: user.displayName || 'Gulesh Patel',
    createdAt: Date.now()
  };
}

/**
 * Normalizes a username into an email string required by Firebase Auth.
 * e.g. "username" -> "username@smartnotes.app"
 */
export function formatAuthEmail(usernameOrEmail: string): string {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }
  return `${clean}@smartnotes.app`;
}

/**
 * Authenticates with Firebase using either username or email.
 * If user does not exist on Firebase yet, automatically registers the user account.
 */
export async function firebaseAuthenticate(
  usernameOrEmail: string,
  password: string,
  displayName?: string
): Promise<UserAccount> {
  if (!auth) {
    throw new Error('Firebase is not configured. Please add the Firebase environment variables to your environment.');
  }

  const email = formatAuthEmail(usernameOrEmail);
  const name = displayName || (usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail);

  try {
    // Attempt sign in
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    return {
      id: user.uid,
      email: user.email || email,
      displayName: user.displayName || name,
      createdAt: Date.now()
    };
  } catch (err: any) {
    // If user not found, auto-create account on Firebase
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-email'
    ) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(newCred.user, { displayName: name });
        return {
          id: newCred.user.uid,
          email: newCred.user.email || email,
          displayName: name,
          createdAt: Date.now()
        };
      } catch (regErr: any) {
        // If register also fails, rethrow with friendly message
        throw new Error(regErr.message || 'Authentication failed');
      }
    }
    throw new Error(err.message || 'Firebase login failed');
  }
}

/**
 * Signs out from Firebase Authentication
 */
export async function firebaseSignOut(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut warning:', err);
  }
}

/**
 * Sanitizes an Item for Firestore so that no undefined values exist
 * (which cause Firestore to throw an error) and types adhere to security rules.
 */
export function sanitizeItemForFirestore(item: Item, userId: string): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(item.id),
    kind: item.kind === 'folder' ? 'folder' : 'note',
    parentId: item.parentId ? String(item.parentId) : null,
    title: item.title || (item.kind === 'folder' ? 'Untitled Folder' : 'Untitled Note'),
    isPinned: Boolean(item.isPinned),
    isDeleted: Boolean(item.isDeleted),
    orderIndex: typeof item.orderIndex === 'number' ? item.orderIndex : 0,
    createdAt: typeof item.createdAt === 'number' && item.createdAt > 0 ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === 'number' && item.updatedAt > 0 ? item.updatedAt : Date.now(),
    version: typeof item.version === 'number' && item.version > 0 ? item.version : 1,
    assetIds: Array.isArray(item.assetIds) ? item.assetIds : [],
    mediaAnnotations: Array.isArray(item.mediaAnnotations) ? item.mediaAnnotations : [],
    userId: userId
  };

  if (item.color && typeof item.color === 'string') {
    clean.color = item.color;
  }
  if (typeof item.contentHtml === 'string') {
    clean.contentHtml = item.contentHtml;
  }
  if (typeof item.plainText === 'string') {
    clean.plainText = item.plainText;
  }
  if (Array.isArray(item.blocks)) {
    clean.blocks = item.blocks;
  }
  if (item.deletedAt !== undefined && item.deletedAt !== null) {
    clean.deletedAt = item.deletedAt;
  }

  return clean;
}

/**
 * Syncs a single Item (note or folder) to Cloud Firestore under users/{userId}/items/{itemId}
 */
export async function syncItemToFirestore(userId: string, item: Item): Promise<void> {
  if (!firestore) return;
  try {
    const itemRef = doc(firestore, 'users', userId, 'items', item.id);
    const cleanData = sanitizeItemForFirestore(item, userId);
    await setDoc(itemRef, cleanData, { merge: true });
  } catch (err) {
    console.warn('Firestore syncItem warning:', err);
    throw err;
  }
}

/**
 * Deletes or marks item deleted in Cloud Firestore
 */
export async function deleteItemInFirestore(userId: string, itemId: string, existingItem?: Item): Promise<void> {
  if (!firestore) return;
  try {
    const itemRef = doc(firestore, 'users', userId, 'items', itemId);
    const now = Date.now();
    if (existingItem) {
      const clean = sanitizeItemForFirestore({
        ...existingItem,
        isDeleted: true,
        deletedAt: now,
        updatedAt: now
      }, userId);
      await setDoc(itemRef, clean, { merge: true });
    } else {
      await setDoc(itemRef, {
        id: itemId,
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
        userId: userId
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore deleteItem warning:', err);
    throw err;
  }
}

/**
 * Fetches all user items from Cloud Firestore
 */
export async function fetchItemsFromFirestore(userId: string): Promise<Item[]> {
  if (!firestore) return [];
  try {
    const coll = collection(firestore, 'users', userId, 'items');
    const snap = await getDocs(coll);
    return snap.docs.map(d => d.data() as Item);
  } catch (err) {
    console.warn('Firestore fetchItems warning:', err);
    return [];
  }
}

/**
 * Subscribes to real-time updates for a user's items in Firestore.
 * Every time any device (PC, phone, web) adds/edits/deletes an item,
 * onUpdate is called with the full updated item collection.
 */
export function subscribeToUserItems(
  userId: string,
  onUpdate: (items: Item[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestore) return () => {};
  const coll = collection(firestore, 'users', userId, 'items');
  const q = query(coll);
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Item[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Item);
      });
      onUpdate(items);
    },
    (err) => {
      console.warn('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Pushes offline outbox mutations to Firestore
 */
export async function pushMutationsToFirestore(
  userId: string,
  mutations: { opId: string; itemId: string; action: 'upsert' | 'delete'; item: Item }[]
): Promise<string[]> {
  const appliedOpIds: string[] = [];
  for (const mut of mutations) {
    try {
      if (mut.action === 'delete') {
        await deleteItemInFirestore(userId, mut.itemId);
      } else if (mut.item) {
        await syncItemToFirestore(userId, mut.item);
      }
      appliedOpIds.push(mut.opId);
    } catch (err) {
      console.warn(`Failed to push mutation ${mut.opId}:`, err);
    }
  }
  return appliedOpIds;
}

export const SYS_GITHUB_CREDS_ID = 'sys-github-credentials';

export function makeGitHubSyncItem(creds: GitHubCredential[], userId: string, vaultUpdatedAt?: number): Item {
  const ts = vaultUpdatedAt || Date.now();
  return {
    id: SYS_GITHUB_CREDS_ID,
    kind: 'note',
    parentId: null,
    title: '__sys_github_credentials__',
    contentHtml: '<p>System Vault Sync</p>',
    plainText: JSON.stringify({
      credentials: creds.filter(c => !c.isDeleted),
      updatedAt: ts
    }),
    isPinned: false,
    isDeleted: false,
    orderIndex: -9999,
    createdAt: 1700000000000,
    updatedAt: ts,
    version: 1,
    assetIds: [],
    mediaAnnotations: []
  };
}

export function parseGitHubSyncItem(item: Item): { credentials: GitHubCredential[]; updatedAt: number } | null {
  if (item.id === SYS_GITHUB_CREDS_ID || item.title === '__sys_github_credentials__') {
    if (item.plainText) {
      try {
        const parsed = JSON.parse(item.plainText);
        if (Array.isArray(parsed)) {
          return {
            credentials: parsed.filter(c => c && !c.isDeleted) as GitHubCredential[],
            updatedAt: item.updatedAt || Date.now()
          };
        }
        if (parsed && Array.isArray(parsed.credentials)) {
          return {
            credentials: parsed.credentials.filter((c: any) => c && !c.isDeleted) as GitHubCredential[],
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : (item.updatedAt || Date.now())
          };
        }
      } catch (err) {
        console.warn('Failed to parse GitHub sync item JSON:', err);
      }
    }
  }
  return null;
}

/**
 * Syncs the entire GitHub credentials vault to Firestore via the guaranteed /users/{userId}/items/sys-github-credentials document.
 * This guarantees 100% compatibility with existing Firestore security rules on all devices without requiring new rule deployments.
 */
export async function syncGitHubVaultToFirestore(userId: string, creds: GitHubCredential[], vaultUpdatedAt?: number): Promise<void> {
  try {
    const item = makeGitHubSyncItem(creds, userId, vaultUpdatedAt);
    await syncItemToFirestore(userId, item);
  } catch (err) {
    console.warn('Failed to sync GitHub vault to items collection:', err);
  }
}

/**
 * Sanitizes a GitHub Credential for Firestore
 */
export function sanitizeGitHubCredentialForFirestore(cred: GitHubCredential, userId: string): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(cred.id),
    username: String(cred.username || '').trim(),
    token: String(cred.token || '').trim(),
    createdAt: typeof cred.createdAt === 'number' && cred.createdAt > 0 ? cred.createdAt : Date.now(),
    updatedAt: Date.now(),
    userId: userId,
    isDeleted: Boolean(cred.isDeleted)
  };

  if (cred.label && typeof cred.label === 'string') {
    clean.label = cred.label.trim();
  }
  if (cred.expiresAt !== undefined) {
    clean.expiresAt = cred.expiresAt;
  }
  if (cred.deletedAt !== undefined) {
    clean.deletedAt = cred.deletedAt;
  }

  return clean;
}

/**
 * Syncs a GitHub credential to Firestore under users/{userId}/github_credentials/{credId}
 */
export async function syncGitHubCredentialToFirestore(userId: string, cred: GitHubCredential): Promise<void> {
  if (!firestore) return;
  try {
    const credRef = doc(firestore, 'users', userId, 'github_credentials', cred.id);
    const cleanData = sanitizeGitHubCredentialForFirestore(cred, userId);
    await setDoc(credRef, cleanData, { merge: true });
  } catch (err) {
    console.warn('Firestore syncGitHubCredential warning:', err);
    throw err;
  }
}

/**
 * Deletes a GitHub credential in Firestore
 */
export async function deleteGitHubCredentialInFirestore(userId: string, credId: string): Promise<void> {
  if (!firestore) return;
  try {
    const credRef = doc(firestore, 'users', userId, 'github_credentials', credId);
    // Mark as isDeleted tombstone first
    await setDoc(credRef, {
      id: credId,
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      userId: userId
    }, { merge: true }).catch(() => {});
    // Also attempt hard deleteDoc
    await deleteDoc(credRef).catch(() => {});
  } catch (err) {
    console.warn('Firestore deleteGitHubCredential warning:', err);
  }
}

/**
 * Fetches all user GitHub credentials from Cloud Firestore
 */
export async function fetchGitHubCredentialsFromFirestore(userId: string): Promise<GitHubCredential[]> {
  if (!firestore) return [];
  try {
    const coll = collection(firestore, 'users', userId, 'github_credentials');
    const snap = await getDocs(coll);
    return snap.docs
      .map(d => d.data() as GitHubCredential)
      .filter(c => c && !c.isDeleted);
  } catch (err) {
    console.warn('Firestore fetchGitHubCredentials warning:', err);
    return [];
  }
}

// Consistency Vault System Sync Model
export const SYS_CONSISTENCY_VAULT_ID = 'sys-consistency-data';

export function makeConsistencySyncItem(vault: ConsistencyVault, userId: string): Item {
  return {
    id: SYS_CONSISTENCY_VAULT_ID,
    kind: 'note',
    parentId: null,
    title: '__sys_consistency_data__',
    contentHtml: '<p>System Consistency Vault Sync</p>',
    plainText: JSON.stringify(vault),
    isPinned: false,
    isDeleted: false,
    orderIndex: -9998,
    createdAt: 1730000000000,
    updatedAt: Date.now(),
    version: 1,
    assetIds: [],
    mediaAnnotations: []
  };
}

export function parseConsistencySyncItem(item: Item): ConsistencyVault | null {
  if (item.id === SYS_CONSISTENCY_VAULT_ID || item.title === '__sys_consistency_data__') {
    if (item.plainText) {
      try {
        const parsed = JSON.parse(item.plainText);
        if (parsed && Array.isArray(parsed.categories)) {
          return parsed as ConsistencyVault;
        }
      } catch (err) {
        console.warn('Failed to parse Consistency sync item JSON:', err);
      }
    }
  }
  return null;
}

export async function syncConsistencyVaultToFirestore(userId: string, vault: ConsistencyVault): Promise<void> {
  try {
    const item = makeConsistencySyncItem(vault, userId);
    await syncItemToFirestore(userId, item);
  } catch (err) {
    console.warn('Failed to sync Consistency vault to items collection:', err);
  }
}

/**
 * Subscribes to real-time updates for a user's GitHub credentials in Firestore.
 */
export function subscribeToGitHubCredentials(
  userId: string,
  onUpdate: (creds: GitHubCredential[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestore) return () => {};
  const coll = collection(firestore, 'users', userId, 'github_credentials');
  const q = query(coll);
  return onSnapshot(
    q,
    (snapshot) => {
      const creds: GitHubCredential[] = [];
      snapshot.forEach(docSnap => {
        const c = docSnap.data() as GitHubCredential;
        if (c && !c.isDeleted) {
          creds.push(c);
        }
      });
      onUpdate(creds);
    },
    (err) => {
      console.warn('Firestore GitHub credentials subscription error:', err);
      if (onError) onError(err);
    }
  );
}

