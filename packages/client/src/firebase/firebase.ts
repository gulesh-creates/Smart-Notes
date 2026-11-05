import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getAuth,
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
import { Item, UserAccount, GitHubCredential } from '@smartnotes/shared';

// Firebase configuration from .env variables with project fallbacks
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC_V4IVWnkbN_UprtIRSlGmI2-U9smjA7w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-notes-2f42a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-notes-2f42a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-notes-2f42a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "837751441535",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:837751441535:web:25575c6cad49ff6180974a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8SPT7NX537"
};

// Initialize Firebase App
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);

// Initialize Analytics if supported in this environment
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then(supported => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(() => {
    // Analytics optional in offline or test environments
  });
}

/**
 * Normalizes a username into an email string required by Firebase Auth.
 * e.g. "gulesh_creates" -> "gulesh_creates@smartnotes.app"
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
    updatedAt: Date.now(),
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
export async function deleteItemInFirestore(userId: string, itemId: string): Promise<void> {
  try {
    const itemRef = doc(firestore, 'users', userId, 'items', itemId);
    await setDoc(itemRef, {
      id: itemId,
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      userId: userId
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore deleteItem warning:', err);
    throw err;
  }
}

/**
 * Fetches all user items from Cloud Firestore
 */
export async function fetchItemsFromFirestore(userId: string): Promise<Item[]> {
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
    userId: userId
  };

  if (cred.label && typeof cred.label === 'string') {
    clean.label = cred.label.trim();
  }
  if (cred.expiresAt !== undefined) {
    clean.expiresAt = cred.expiresAt;
  }

  return clean;
}

/**
 * Syncs a GitHub credential to Firestore under users/{userId}/github_credentials/{credId}
 */
export async function syncGitHubCredentialToFirestore(userId: string, cred: GitHubCredential): Promise<void> {
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
  try {
    const credRef = doc(firestore, 'users', userId, 'github_credentials', credId);
    await deleteDoc(credRef);
  } catch (err) {
    console.warn('Firestore deleteGitHubCredential warning:', err);
    throw err;
  }
}

/**
 * Fetches all user GitHub credentials from Cloud Firestore
 */
export async function fetchGitHubCredentialsFromFirestore(userId: string): Promise<GitHubCredential[]> {
  try {
    const coll = collection(firestore, 'users', userId, 'github_credentials');
    const snap = await getDocs(coll);
    return snap.docs.map(d => d.data() as GitHubCredential);
  } catch (err) {
    console.warn('Firestore fetchGitHubCredentials warning:', err);
    return [];
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
  const coll = collection(firestore, 'users', userId, 'github_credentials');
  const q = query(coll);
  return onSnapshot(
    q,
    (snapshot) => {
      const creds: GitHubCredential[] = [];
      snapshot.forEach(docSnap => {
        creds.push(docSnap.data() as GitHubCredential);
      });
      onUpdate(creds);
    },
    (err) => {
      console.warn('Firestore GitHub credentials subscription error:', err);
      if (onError) onError(err);
    }
  );
}

