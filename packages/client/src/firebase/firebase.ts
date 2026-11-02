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
  Firestore
} from 'firebase/firestore';
import { Item, UserAccount } from '@smartnotes/shared';

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
 * Syncs a single Item (note or folder) to Cloud Firestore under users/{userId}/items/{itemId}
 */
export async function syncItemToFirestore(userId: string, item: Item): Promise<void> {
  try {
    const itemRef = doc(firestore, 'users', userId, 'items', item.id);
    await setDoc(itemRef, {
      ...item,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore syncItem warning:', err);
  }
}

/**
 * Deletes or marks item deleted in Cloud Firestore
 */
export async function deleteItemInFirestore(userId: string, itemId: string): Promise<void> {
  try {
    const itemRef = doc(firestore, 'users', userId, 'items', itemId);
    await setDoc(itemRef, { isDeleted: true, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn('Firestore deleteItem warning:', err);
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
