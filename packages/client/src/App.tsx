import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Item,
  Asset,
  MediaAnnotationRecord,
  SyncConflict,
  UserAccount,
  GitHubCredential,
  ConsistencyVault,
  buildBreadcrumbPath,
  wouldCreateCycle,
  getDescendantIds
} from '@smartnotes/shared';
import {
  IconSettings, IconPlus, IconFolder, IconNote, IconSync,
  IconSun, IconMoon, IconCheck, IconBack, IconClose,
  IconSearch, IconPin, IconTrash, IconUndo, IconConflict, IconMonitor, IconGitHub
} from './components/icons/Icons';
import { TreeRail } from './components/navigation/TreeRail';
import { NoteList } from './components/navigation/NoteList';
import { RichEditor } from './components/editor/RichEditor';
import { GitHubTokenManager } from './components/github/GitHubTokenManager';
import { ConsistencyWorkspace } from './components/consistency/ConsistencyWorkspace';
import { FocusTimerFloatingBar } from './components/consistency/FocusTimerFloatingBar';
import { AndroidAppView } from './components/mobile/AndroidAppView';
import { MoveItemModal } from './components/modals/MoveItemModal';
import { ConflictModal } from './components/modals/ConflictModal';
import { SyncSettingsModal } from './components/modals/SyncSettingsModal';
import { FolderModal } from './components/modals/FolderModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { INITIAL_SAMPLE_ITEMS, createInitialSampleAssets } from './sampleData';
import {
  dbGetAllItems,
  dbSaveItem,
  dbSaveItemsBatch,
  dbMarkItemDeleted,
  dbGetAsset,
  dbSaveAsset,
  StoredAssetRecord,
  dbGetSetting,
  dbSetSetting,
  dbGetOutboxMutations,
  dbRemoveOutboxMutations,
  dbGetGitHubCredentials,
  dbSaveGitHubCredential,
  dbDeleteGitHubCredential,
  dbGetGitHubDeletedTombstones,
  dbGetGitHubVaultUpdatedAt,
  dbSetGitHubVaultUpdatedAt,
  reconcileGitHubCredentials
} from './storage/db';
import {
  dbGetConsistencyVault,
  dbSaveConsistencyVault,
  calculateStreak
} from './storage/consistencyDb';
import {
  auth,
  firebaseAuthenticate,
  firebaseSignOut,
  syncItemToFirestore,
  deleteItemInFirestore,
  fetchItemsFromFirestore,
  subscribeToUserItems,
  pushMutationsToFirestore,
  syncGitHubCredentialToFirestore,
  deleteGitHubCredentialInFirestore,
  fetchGitHubCredentialsFromFirestore,
  subscribeToGitHubCredentials,
  SYS_GITHUB_CREDS_ID,
  parseGitHubSyncItem,
  syncGitHubVaultToFirestore,
  SYS_CONSISTENCY_VAULT_ID,
  parseConsistencySyncItem,
  syncConsistencyVaultToFirestore
} from './firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const isSystemItem = (item: Item): boolean =>
  item.id === SYS_GITHUB_CREDS_ID ||
  item.title === '__sys_github_credentials__' ||
  item.id === SYS_CONSISTENCY_VAULT_ID ||
  item.title === '__sys_consistency_data__' ||
  item.id.startsWith('sys-');

async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const App: React.FC = () => {
  // Core Items & Selection
  const [items, setItems] = useState<Item[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [specialFilter, setSpecialFilter] = useState<'all' | 'pinned' | 'recent' | 'trash' | 'github' | 'consistency'>('all');
  const [githubCredentials, setGithubCredentials] = useState<GitHubCredential[]>([]);
  const [consistencyStreak, setConsistencyStreak] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // States
  const [localSaveState, setLocalSaveState] = useState<'saving' | 'saved' | 'error'>('saved');
  const [cloudSyncState, setCloudSyncState] = useState<'synced' | 'pending' | 'offline' | 'conflict'>('synced');
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null);

  // Layout & UI
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(window.innerWidth < 860);
  const [previewMobileMode, setPreviewMobileMode] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isNoteListCollapsed, setIsNoteListCollapsed] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  // Modals
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Folder Create/Edit Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit'>('create');
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<Item | null>(null);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // User & Sync Auth
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  // 1. Initial Load & Firebase Auth Persistence
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    let unsubscribeGitHub: (() => void) | null = null;
    let unsubscribeAuth: (() => void) | null = null;

    const initApp = async () => {
      try {
        // Load theme
        const savedTheme = await dbGetSetting<'light' | 'dark' | 'system'>('app_theme', 'light');
        setTheme(savedTheme);
        applyTheme(savedTheme);

        // Load items from local IndexedDB first (instant offline availability)
        let storedItems = (await dbGetAllItems(true)).filter(i => !isSystemItem(i));
        if (!storedItems || storedItems.length === 0) {
          storedItems = INITIAL_SAMPLE_ITEMS;
          await dbSaveItemsBatch(storedItems);
          const sampleAssets = createInitialSampleAssets();
          for (const a of sampleAssets) {
            await dbSaveAsset(a);
          }
        }
        setItems(storedItems);
        const firstNote = storedItems.find(i => i.kind === 'note' && !i.isDeleted);
        if (firstNote) {
          setSelectedNoteId(firstNote.id);
        }

        // Load GitHub credentials from local IndexedDB
        const storedCreds = await dbGetGitHubCredentials();
        if (storedCreds) {
          setGithubCredentials(storedCreds);
        }

        // Load Consistency vault and streak from local IndexedDB
        try {
          const storedVault = await dbGetConsistencyVault();
          const strk = calculateStreak(storedVault);
          setConsistencyStreak(strk.currentStreak);
        } catch (cErr) {
          console.warn('Initial consistency load notice:', cErr);
        }

        // Setup Firebase Auth State Listener for real-time cloud sync across devices
        if (auth) {
          unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
              const userAccount: UserAccount = {
                id: fbUser.uid,
                email: fbUser.email || `${fbUser.displayName || 'user'}@smartnotes.app`,
                displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'gulesh_creates'),
                createdAt: Date.now()
              };
              setAuthToken(fbUser.uid);
              setCurrentUser(userAccount);
              await dbSetSetting('auth_token', fbUser.uid);
              await dbSetSetting('auth_user', JSON.stringify(userAccount));
              setCloudSyncState('synced');

              // Attach real-time Firestore synchronization listener for items & GitHub vault
              if (unsubscribeFirestore) unsubscribeFirestore();
              unsubscribeFirestore = subscribeToUserItems(
                fbUser.uid,
                async (remoteItems) => {
                  if (remoteItems && remoteItems.length > 0) {
                    // 1. Check if there is a sys-github-credentials sync item in remote items
                    const ghSyncDoc = remoteItems.find(i => i.id === SYS_GITHUB_CREDS_ID || i.title === '__sys_github_credentials__');
                    if (ghSyncDoc) {
                      const parsed = parseGitHubSyncItem(ghSyncDoc);
                      if (parsed) {
                        const local = await dbGetGitHubCredentials();
                        const tombstones = await dbGetGitHubDeletedTombstones();
                        const localVaultTime = await dbGetGitHubVaultUpdatedAt();

                        let reconciled: GitHubCredential[];
                        if (parsed.updatedAt > localVaultTime) {
                          // Remote vault is newer: accept remote creds filtered by local tombstones
                          reconciled = reconcileGitHubCredentials([], parsed.credentials, tombstones);
                          await dbSetGitHubVaultUpdatedAt(parsed.updatedAt);
                        } else {
                          // Local is equal or newer: reconcile local with remote creds
                          reconciled = reconcileGitHubCredentials(local, parsed.credentials, tombstones);
                        }
                        await dbSetSetting('github_credentials', reconciled);
                        setGithubCredentials(reconciled);
                      }
                    }

                    // 2. Check if there is a sys-consistency-data sync item in remote items
                    const consistencySyncDoc = remoteItems.find(i => i.id === SYS_CONSISTENCY_VAULT_ID || i.title === '__sys_consistency_data__');
                    if (consistencySyncDoc) {
                      const parsedVault = parseConsistencySyncItem(consistencySyncDoc);
                      if (parsedVault) {
                        const localVault = await dbGetConsistencyVault();
                        if (!localVault || parsedVault.updatedAt > localVault.updatedAt) {
                          await dbSaveConsistencyVault(parsedVault);
                          const strk = calculateStreak(parsedVault);
                          setConsistencyStreak(strk.currentStreak);
                        }
                      }
                    }

                    // 3. Regular note items (filtered from system items)
                    const regularItems = remoteItems.filter(i => !isSystemItem(i));
                    await dbSaveItemsBatch(regularItems);
                    const all = (await dbGetAllItems(true)).filter(i => !isSystemItem(i));
                    setItems(all);
                    setCloudSyncState('synced');
                  }
                },
                (err) => {
                  console.warn('Real-time sync notice:', err);
                }
              );

              // Attach real-time GitHub credentials listener (for direct collection if permitted)
              if (unsubscribeGitHub) unsubscribeGitHub();
              unsubscribeGitHub = subscribeToGitHubCredentials(
                fbUser.uid,
                async (remoteCreds) => {
                  if (remoteCreds) {
                    const local = await dbGetGitHubCredentials();
                    const tombstones = await dbGetGitHubDeletedTombstones();
                    const reconciled = reconcileGitHubCredentials(local, remoteCreds, tombstones);
                    await dbSetSetting('github_credentials', reconciled);
                    setGithubCredentials(reconciled);
                  }
                },
                (err) => {
                  console.warn('Real-time GitHub credentials notice:', err);
                }
              );

              // Merge local items with Firestore to guarantee no offline work is lost
              try {
                const localItems = (await dbGetAllItems(true)).filter(i => !isSystemItem(i));
                for (const item of localItems) {
                  await syncItemToFirestore(fbUser.uid, item).catch(() => { });
                }
                const remote = await fetchItemsFromFirestore(fbUser.uid);
                if (remote && remote.length > 0) {
                  // Check if remote items include sys-github-credentials
                  const ghDoc = remote.find(i => i.id === SYS_GITHUB_CREDS_ID || i.title === '__sys_github_credentials__');
                  if (ghDoc) {
                    const parsed = parseGitHubSyncItem(ghDoc);
                    if (parsed) {
                      const local = await dbGetGitHubCredentials();
                      const tombstones = await dbGetGitHubDeletedTombstones();
                      const localVaultTime = await dbGetGitHubVaultUpdatedAt();

                      let reconciled: GitHubCredential[];
                      if (parsed.updatedAt > localVaultTime) {
                        reconciled = reconcileGitHubCredentials([], parsed.credentials, tombstones);
                        await dbSetGitHubVaultUpdatedAt(parsed.updatedAt);
                      } else {
                        reconciled = reconcileGitHubCredentials(local, parsed.credentials, tombstones);
                      }
                      await dbSetSetting('github_credentials', reconciled);
                      setGithubCredentials(reconciled);
                    }
                  }

                  // Check if remote items include sys-consistency-data
                  const consistencyDoc = remote.find(i => i.id === SYS_CONSISTENCY_VAULT_ID || i.title === '__sys_consistency_data__');
                  if (consistencyDoc) {
                    const parsedVault = parseConsistencySyncItem(consistencyDoc);
                    if (parsedVault) {
                      const localVault = await dbGetConsistencyVault();
                      if (!localVault || parsedVault.updatedAt > localVault.updatedAt) {
                        await dbSaveConsistencyVault(parsedVault);
                        const strk = calculateStreak(parsedVault);
                        setConsistencyStreak(strk.currentStreak);
                      }
                    }
                  }
                  const regular = remote.filter(i => !isSystemItem(i));
                  await dbSaveItemsBatch(regular);
                  const all = (await dbGetAllItems(true)).filter(i => !isSystemItem(i));
                  setItems(all);
                }
              } catch (mergeErr) {
                console.warn('Initial cloud merge notice:', mergeErr);
              }

              // Guaranteed push of local GitHub credentials to Firestore so Vercel gets them immediately
              try {
                const localCreds = await dbGetGitHubCredentials();
                const tombstones = await dbGetGitHubDeletedTombstones();
                const vaultUpdatedAt = await dbGetGitHubVaultUpdatedAt();

                await syncGitHubVaultToFirestore(fbUser.uid, localCreds, vaultUpdatedAt);
                for (const cred of localCreds) {
                  await syncGitHubCredentialToFirestore(fbUser.uid, cred).catch(() => { });
                }
                const remoteCreds = await fetchGitHubCredentialsFromFirestore(fbUser.uid);
                if (remoteCreds) {
                  const reconciled = reconcileGitHubCredentials(localCreds, remoteCreds, tombstones);
                  await dbSetSetting('github_credentials', reconciled);
                  setGithubCredentials(reconciled);
                }
              } catch (credMergeErr) {
                console.warn('Initial GitHub cloud merge notice:', credMergeErr);
              }

              // Guaranteed push of local Consistency vault to Firestore so Vercel & Mobile get it immediately
              try {
                const localVault = await dbGetConsistencyVault();
                if (localVault) {
                  await syncConsistencyVaultToFirestore(fbUser.uid, localVault);
                }
              } catch (cPushErr) {
                console.warn('Initial Consistency cloud push notice:', cPushErr);
              }

              // Push any pending outbox mutations
              const mutations = await dbGetOutboxMutations();
              if (mutations.length > 0) {
                const applied = await pushMutationsToFirestore(fbUser.uid, mutations);
                if (applied.length > 0) {
                  await dbRemoveOutboxMutations(applied);
                }
              }
            } else {
              // Check if we previously had cached user credentials to try auto-connecting
              const token = await dbGetSetting<string | null>('auth_token', null);
              const savedUserStr = await dbGetSetting<string | null>('auth_user', null);
              if (token && savedUserStr) {
                try {
                  const parsed = JSON.parse(savedUserStr);
                  setCurrentUser(parsed);
                  setAuthToken(token);
                } catch {
                  setCloudSyncState('offline');
                }
              } else {
                setCloudSyncState('offline');
              }
            }
          });
        } else {
          console.info('Firebase not configured: Running in local offline mode.');
          const token = await dbGetSetting<string | null>('auth_token', null);
          const savedUserStr = await dbGetSetting<string | null>('auth_user', null);
          if (token && savedUserStr) {
            try {
              const parsed = JSON.parse(savedUserStr);
              setCurrentUser(parsed);
              setAuthToken(token);
            } catch {
              setCloudSyncState('offline');
            }
          } else {
            setCloudSyncState('offline');
          }
        }
      } catch (err) {
        console.error('Failed to initialize app storage:', err);
      }
    };

    initApp();

    // Responsive listener
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 860);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (unsubscribeGitHub) unsubscribeGitHub();
    };
  }, []);

  // Theme application helper
  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    let effective = t;
    if (t === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = isDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    applyTheme(newTheme);
    await dbSetSetting('app_theme', newTheme);
  };

  const handleLogin = async (email: string, pass: string) => {
    try {
      setCloudSyncState('pending');
      const fbUser = await firebaseAuthenticate(email, pass);
      setAuthToken(fbUser.id);
      setCurrentUser(fbUser);
      await dbSetSetting('auth_token', fbUser.id);
      await dbSetSetting('auth_user', JSON.stringify(fbUser));
      showToast(`Welcome back, ${fbUser.displayName}!`);

      // 1. Push any local notes/folders to Firestore so PC and Phone work together
      const localItems = await dbGetAllItems(true);
      for (const item of localItems) {
        await syncItemToFirestore(fbUser.id, item).catch(() => { });
      }

      // 2. Fetch all cloud items and merge into local IndexedDB
      const remoteItems = await fetchItemsFromFirestore(fbUser.id);
      if (remoteItems && remoteItems.length > 0) {
        await dbSaveItemsBatch(remoteItems);
        const all = await dbGetAllItems(true);
        setItems(all);
      }

      setCloudSyncState('synced');
    } catch (fbErr: any) {
      console.warn('Firebase login attempt failed:', fbErr?.message || fbErr);
      setCloudSyncState('offline');
      throw new Error(fbErr?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleRegister = async (email: string, pass: string, name: string) => {
    try {
      setCloudSyncState('pending');
      const fbUser = await firebaseAuthenticate(email, pass, name);
      setAuthToken(fbUser.id);
      setCurrentUser(fbUser);
      await dbSetSetting('auth_token', fbUser.id);
      await dbSetSetting('auth_user', JSON.stringify(fbUser));
      showToast(`Account created for ${fbUser.displayName}!`);

      const localItems = await dbGetAllItems(true);
      for (const item of localItems) {
        await syncItemToFirestore(fbUser.id, item).catch(() => { });
      }
      setCloudSyncState('synced');
    } catch (fbErr: any) {
      console.warn('Firebase register attempt failed:', fbErr?.message || fbErr);
      setCloudSyncState('offline');
      throw new Error(fbErr?.message || 'Registration failed.');
    }
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setCurrentUser(null);
    await dbSetSetting('auth_token', null);
    await dbSetSetting('auth_user', null);
    await firebaseSignOut();
    setCloudSyncState('offline');
    showToast('Signed out of cloud sync.');
  };

  // Background Cloud Sync Loop
  const triggerSync = useCallback(async () => {
    if (!currentUser?.id) {
      setCloudSyncState('offline');
      return;
    }

    try {
      setCloudSyncState('pending');
      const mutations = await dbGetOutboxMutations();

      // 1. Push pending offline mutations to Cloud Firestore
      if (mutations.length > 0) {
        const appliedOpIds = await pushMutationsToFirestore(currentUser.id, mutations);
        if (appliedOpIds.length > 0) {
          await dbRemoveOutboxMutations(appliedOpIds);
        }
      }

      // 2. Fetch latest items from Firestore to guarantee complete multi-device consistency
      const remoteItems = await fetchItemsFromFirestore(currentUser.id);
      if (remoteItems && remoteItems.length > 0) {
        await dbSaveItemsBatch(remoteItems);
        const all = await dbGetAllItems(true);
        setItems(all);
      }

      setCloudSyncState('synced');
    } catch (err) {
      console.warn('Firestore background sync loop notice:', err);
      setCloudSyncState('offline');
    }
  }, [currentUser]);

  useEffect(() => {
    const interval = setInterval(triggerSync, 15000);
    return () => clearInterval(interval);
  }, [triggerSync]);

  // Persistent Database & Cloud Sync Helper
  const persistItem = async (item: Item, queueForSync = true) => {
    await dbSaveItem(item, queueForSync);
    if (currentUser?.id) {
      try {
        await syncItemToFirestore(currentUser.id, item);
        setCloudSyncState('synced');
      } catch (err) {
        console.warn('Firestore sync notice:', err);
        setCloudSyncState('pending');
      }
    }
  };

  // Note Selection & Editing
  const selectedNote = items.find(i => i.id === selectedNoteId && !i.isDeleted) || null;

  const handleUpdateNote = (updated: Partial<Item>) => {
    if (!selectedNoteId) return;

    setLocalSaveState('saving');
    const now = Date.now();

    let mergedItem: Item | undefined;

    setItems(prev => {
      const next = prev.map(item => {
        if (item.id === selectedNoteId) {
          const m = {
            ...item,
            ...updated,
            version: (item.version || 1) + 1,
            updatedAt: now
          };
          mergedItem = m;
          return m;
        }
        return item;
      });
      return next;
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        let toSave = mergedItem;
        if (!toSave) {
          const all = await dbGetAllItems(true);
          const found = all.find(i => i.id === selectedNoteId);
          if (found) {
            toSave = {
              ...found,
              ...updated,
              version: (found.version || 1) + 1,
              updatedAt: Date.now()
            };
          }
        }
        if (toSave) {
          await persistItem(toSave, true);
          setLocalSaveState('saved');
        }
      } catch (e) {
        console.error('Failed to autosave note:', e);
        setLocalSaveState('error');
      }
    }, 350);
  };

  // Item Creation Handlers
  const handleCreateNote = async (parentId?: string | null) => {
    const pId = parentId !== undefined ? parentId : selectedFolderId;
    const newId = `note-${Date.now()}`;
    const newNote: Item = {
      id: newId,
      kind: 'note',
      title: 'Untitled Note',
      parentId: pId || null,
      orderIndex: items.length,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
      isPinned: false,
      contentHtml: '<p></p>',
      plainText: '',
      assetIds: [],
      mediaAnnotations: []
    };

    await persistItem(newNote, true);
    setItems(prev => [...prev, newNote]);
    setSelectedNoteId(newId);
    showToast('New note created');
    if (authToken) triggerSync();
  };

  // Folder Modal Handlers (Create & Customize/Rename)
  const handleOpenCreateFolderModal = (parentId?: string | null) => {
    const pId = parentId !== undefined ? parentId : selectedFolderId;
    setFolderModalMode('create');
    setFolderModalParentId(pId || null);
    setFolderToEdit(null);
    setIsFolderModalOpen(true);
  };

  const handleOpenRenameFolderModal = (folderId: string) => {
    const folder = items.find(i => i.id === folderId);
    if (folder) {
      setFolderModalMode('edit');
      setFolderToEdit(folder);
      setFolderModalParentId(folder.parentId);
      setIsFolderModalOpen(true);
    }
  };

  const handleFolderModalSubmit = async ({ title, color, parentId }: { title: string; color: string; parentId?: string | null }) => {
    if (folderModalMode === 'create') {
      const pId = parentId !== undefined ? parentId : selectedFolderId;
      const newFolderId = `folder-${Date.now()}`;
      const newFolder: Item = {
        id: newFolderId,
        kind: 'folder',
        title: title || 'Untitled Folder',
        color: color,
        parentId: pId || null,
        orderIndex: items.length,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        isPinned: false,
        assetIds: [],
        mediaAnnotations: []
      };

      await persistItem(newFolder, true);
      setItems(prev => [...prev, newFolder]);
      setSelectedFolderId(newFolderId);
      setSpecialFilter('all');
      showToast(`Folder "${newFolder.title}" created`);
      if (authToken) triggerSync();
    } else if (folderModalMode === 'edit' && folderToEdit) {
      const updatedFolder: Item = {
        ...folderToEdit,
        title: title || 'Untitled Folder',
        color: color,
        version: folderToEdit.version + 1,
        updatedAt: Date.now()
      };

      await persistItem(updatedFolder, true);
      setItems(prev => prev.map(i => (i.id === updatedFolder.id ? updatedFolder : i)));
      showToast(`Folder "${updatedFolder.title}" updated`);
      if (authToken) triggerSync();
    }
  };

  const handleCreateFolder = async (parentId?: string | null) => {
    handleOpenCreateFolderModal(parentId);
  };

  // Safe Delete with Confirmation Handlers
  const handleRequestDelete = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setItemToDelete(item);
      setIsDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = async (itemId: string) => {
    await handleDeleteItem(itemId);
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const handleCreateChildNote = async () => {
    if (!selectedNoteId) return;
    const newId = `note-${Date.now()}`;
    const childNote: Item = {
      id: newId,
      kind: 'note',
      title: 'Untitled Child Note',
      parentId: selectedNoteId,
      orderIndex: items.length,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
      isPinned: false,
      contentHtml: '<p></p>',
      plainText: '',
      assetIds: [],
      mediaAnnotations: []
    };

    await persistItem(childNote, true);
    setItems(prev => [...prev, childNote]);
    setSelectedNoteId(newId);
    showToast('Nested child note created');
    if (authToken) triggerSync();
  };

  // Move & Delete Handlers
  const handleOpenMoveModal = (itemId: string) => {
    setMovingItemId(itemId);
    setIsMoveModalOpen(true);
  };

  const handleConfirmMove = async (itemId: string, targetParentId: string | null) => {
    if (wouldCreateCycle(items, itemId, targetParentId)) {
      showToast('Cannot move item into itself or its descendants!');
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updatedItem: Item = {
      ...item,
      parentId: targetParentId,
      version: item.version + 1,
      updatedAt: Date.now()
    };

    await persistItem(updatedItem, true);
    setItems(prev => prev.map(i => (i.id === itemId ? updatedItem : i)));
    setIsMoveModalOpen(false);
    setMovingItemId(null);
    showToast(`Moved "${item.title}" successfully`);
    if (authToken) triggerSync();
  };

  const handleDeleteItem = async (itemId: string) => {
    const descIds = getDescendantIds(items, itemId);
    const allIdsToDelete = [itemId, ...descIds];

    for (const id of allIdsToDelete) {
      const item = items.find(i => i.id === id);
      await dbMarkItemDeleted(id);
      if (currentUser?.id) {
        await deleteItemInFirestore(currentUser.id, id, item).catch(() => { });
      }
    }

    setItems(prev =>
      prev.map(i =>
        allIdsToDelete.includes(i.id) ? { ...i, isDeleted: true, updatedAt: Date.now() } : i
      )
    );

    if (selectedNoteId && allIdsToDelete.includes(selectedNoteId)) {
      const remainingNotes = items.filter(
        i => i.kind === 'note' && !i.isDeleted && !allIdsToDelete.includes(i.id)
      );
      setSelectedNoteId(remainingNotes.length > 0 ? remainingNotes[0].id : null);
    }

    showToast('Moved to Trash');
    if (authToken) triggerSync();
  };

  // Binary Asset Handlers
  const handleAttachAsset = async (file: File) => {
    if (!selectedNote) return;

    try {
      const sha256 = await computeSha256(file);
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const storedAsset: StoredAssetRecord = {
        id: assetId,
        sha256,
        mimeType: file.type || 'application/octet-stream',
        byteLength: file.size,
        filename: file.name,
        blob: file,
        createdAt: Date.now(),
        syncState: 'local'
      };

      await dbSaveAsset(storedAsset);

      const existingAssets = selectedNote.assetIds || [];
      handleUpdateNote({
        assetIds: [...existingAssets, assetId]
      });

      showToast(`Attached ${file.name}`);

      // Optional upload if authenticated
      if (authToken) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('id', assetId);
        formData.append('sha256', sha256);
        fetch('/api/assets/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData
        }).catch(err => console.log('Asset server backup skipped (offline):', err));
      }
    } catch (err) {
      console.error('Failed to attach asset:', err);
      showToast('Error attaching file');
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    if (!selectedNote) return;
    const remainingAssetIds = (selectedNote.assetIds || []).filter(id => id !== assetId);
    const remainingAnnotations = (selectedNote.mediaAnnotations || []).filter(a => a.assetId !== assetId);

    handleUpdateNote({
      assetIds: remainingAssetIds,
      mediaAnnotations: remainingAnnotations
    });
    showToast('Attachment removed from note');
  };

  const handleSaveAnnotation = (annotation: MediaAnnotationRecord) => {
    if (!selectedNote) return;
    const existing = selectedNote.mediaAnnotations || [];
    const index = existing.findIndex(a => a.assetId === annotation.assetId && a.pageIndex === annotation.pageIndex);

    let next: MediaAnnotationRecord[];
    if (index >= 0) {
      next = [...existing];
      next[index] = annotation;
    } else {
      next = [...existing, annotation];
    }

    handleUpdateNote({ mediaAnnotations: next });
  };

  // GitHub Credentials Handlers
  const handleSaveGitHubCredential = async (data: {
    id?: string;
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
  }) => {
    const id = data.id || `gh-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const cred: GitHubCredential = {
      id,
      username: data.username,
      token: data.token,
      label: data.label,
      expiresAt: data.expiresAt,
      createdAt: data.id ? (githubCredentials.find(c => c.id === data.id)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now(),
      userId: currentUser?.id
    };

    const updated = await dbSaveGitHubCredential(cred);
    setGithubCredentials(updated);
    showToast(data.id ? 'GitHub credential updated' : 'GitHub credential saved');

    if (currentUser?.id) {
      const vaultUpdatedAt = await dbGetGitHubVaultUpdatedAt();
      // 1. Guaranteed sync via items collection (sys-github-credentials)
      await syncGitHubVaultToFirestore(currentUser.id, updated, vaultUpdatedAt).catch(err => {
        console.warn('Failed to sync GitHub vault to items collection:', err);
      });
      // 2. Also try direct subcollection
      syncGitHubCredentialToFirestore(currentUser.id, cred).catch(() => { });
    }
  };

  const handleDeleteGitHubCredential = async (id: string) => {
    const updated = await dbDeleteGitHubCredential(id);
    setGithubCredentials(updated);
    showToast('GitHub credential deleted');

    if (currentUser?.id) {
      const vaultUpdatedAt = await dbGetGitHubVaultUpdatedAt();
      // 1. Guaranteed sync via items collection (sys-github-credentials) with updated list
      await syncGitHubVaultToFirestore(currentUser.id, updated, vaultUpdatedAt).catch(err => {
        console.warn('Failed to sync GitHub vault to items collection:', err);
      });
      // 2. Also clean up direct subcollection document
      await deleteGitHubCredentialInFirestore(currentUser.id, id).catch(() => { });
    }
  };

  // Conflict Resolution
  const handleResolveConflict = async (resolvedItem: Item) => {
    await persistItem(resolvedItem, true);
    setItems(prev => prev.map(i => (i.id === resolvedItem.id ? resolvedItem : i)));
    setSyncConflict(null);
    setCloudSyncState('synced');
    showToast('Conflict resolved successfully');
    if (authToken) triggerSync();
  };

  // Breadcrumbs & Children for current selection
  const breadcrumbs = selectedNote ? buildBreadcrumbPath(items, selectedNote.id) : [];
  const childNotes = selectedNote
    ? items.filter(i => i.kind === 'note' && i.parentId === selectedNote.id && !i.isDeleted)
    : [];

  // Filtered notes list for center panel
  const getNotesForList = (): Item[] => {
    let base = items.filter(i => i.kind === 'note' && !isSystemItem(i));

    if (specialFilter === 'trash') {
      return base.filter(i => i.isDeleted);
    }

    // Active (non-deleted) items
    base = base.filter(i => !i.isDeleted);

    if (specialFilter === 'pinned') {
      return base.filter(i => i.isPinned);
    }

    if (specialFilter === 'recent') {
      return [...base].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // Filter by selected folder or root
    if (selectedFolderId) {
      return base.filter(i => i.parentId === selectedFolderId);
    }

    return base;
  };

  const currentFolder = items.find(i => i.id === selectedFolderId);
  const noteListTitle =
    specialFilter === 'pinned'
      ? 'Pinned Notes'
      : specialFilter === 'recent'
        ? 'Recent Notes'
        : specialFilter === 'trash'
          ? 'Trash'
          : currentFolder
            ? currentFolder.title
            : 'All Notes';

  // Toggle mobile/desktop view
  const isMobile = isMobileScreen || previewMobileMode;

  return (
    <div className="smart-notes-app-root" style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="toast-notification"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            background: 'var(--card-dark-accent)',
            color: 'var(--card-dark-text)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-float)',
            fontSize: '0.84rem',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInDown 0.2s ease-out'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--lime-primary)' }} />
          {toastMessage}
        </div>
      )}

      {/* RENDER MODE A: NATIVE FULLSCREEN MOBILE LAYOUT */}
      {isMobile ? (
        <AndroidAppView
          items={items}
          selectedNote={selectedNote}
          breadcrumbs={breadcrumbs}
          childNotes={childNotes}
          localSaveState={localSaveState}
          cloudSyncState={cloudSyncState}
          githubCredentials={githubCredentials}
          onSelectNote={(id) => setSelectedNoteId(id)}
          onUpdateNote={handleUpdateNote}
          onCreateNote={handleCreateNote}
          onCreateFolder={handleCreateFolder}
          onCreateChildNote={handleCreateChildNote}
          onAttachAsset={handleAttachAsset}
          onDeleteAsset={handleDeleteAsset}
          onSaveAnnotation={handleSaveAnnotation}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onSaveGitHubCredential={handleSaveGitHubCredential}
          onDeleteGitHubCredential={handleDeleteGitHubCredential}
          onDeleteItem={handleRequestDelete}
          onSyncConsistencyVault={(updatedVault) => {
            const strk = calculateStreak(updatedVault);
            setConsistencyStreak(strk.currentStreak);
            if (currentUser?.id) {
              syncConsistencyVaultToFirestore(currentUser.id, updatedVault).catch(err => {
                console.warn('Failed to sync Consistency vault:', err);
              });
            }
          }}
        />
      ) : (
        /* RENDER MODE B: RESPONSIVE DESKTOP 3-PANE LAYOUT */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Desktop Global Header Bar */}
          <header
            style={{
              height: 'var(--header-height)',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              zIndex: 100
            }}
          >
            {/* Left: Branding & Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--lime-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconNote size={16} color="var(--text-on-lime)" />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Smart Notes
                </span>
              </div>

              {/* Status Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                <span className="badge badge-lime" title="Changes immediately saved to IndexedDB">
                  Saved on this device
                </span>

                <span
                  className="badge"
                  style={{
                    background: cloudSyncState === 'synced' ? 'var(--bg-surface-subtle)' : 'var(--danger-bg)',
                    color: cloudSyncState === 'synced' ? 'var(--text-secondary)' : 'var(--danger)'
                  }}
                  title={authToken ? 'Connected to Cloud Backend' : 'Offline / Local-Only Mode'}
                >
                  <IconSync size={11} color="currentColor" />
                  {cloudSyncState === 'synced' ? (authToken ? 'Cloud Synced' : 'Local Only') : cloudSyncState.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Right: Actions & Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Focused Writing Mode Toggle */}
              <button
                type="button"
                className={`btn btn-sm ${focusMode ? 'btn-primary' : ''}`}
                onClick={() => setFocusMode(prev => !prev)}
                title="Focused Writing Mode: Hide sidebars"
              >
                {focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
              </button>

              {/* Quick Note Action */}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleCreateNote(selectedFolderId)}
                title="Create New Note (Ctrl+N)"
              >
                <IconPlus size={14} />
                New Note
              </button>

              {/* Theme Toggle Shortcut */}
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')}
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                aria-label="Toggle Theme"
              >
                {theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
              </button>

              {/* Settings / Account Modal */}
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setIsSettingsModalOpen(true)}
                title="Settings & Cloud Account"
                aria-label="Settings"
              >
                <IconSettings size={16} />
              </button>

              {/* Desktop Mobile Simulator Preview Toggle */}
              <button
                type="button"
                className="btn btn-icon btn-sm"
                style={{ marginLeft: '6px' }}
                onClick={() => setPreviewMobileMode(true)}
                title="Preview Fullscreen Mobile App View"
                aria-label="Mobile Preview"
              >
                <IconMonitor size={16} />
              </button>
            </div>
          </header>

          {/* Desktop 3-Pane Body Grid */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* PANE 1: FOLDER TREE RAIL (Collapsible) */}
            {!focusMode && !isSidebarCollapsed && (
              <aside
                style={{
                  width: 'var(--sidebar-w)',
                  flexShrink: 0,
                  borderRight: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <TreeRail
                  items={items}
                  selectedFolderId={selectedFolderId}
                  selectedNoteId={selectedNoteId}
                  specialFilter={specialFilter}
                  githubCount={githubCredentials.length}
                  consistencyStreak={consistencyStreak}
                  onSelectFolder={(folderId) => {
                    setSelectedFolderId(folderId);
                    setSpecialFilter('all');
                  }}
                  onSelectNote={(noteId) => {
                    setSelectedNoteId(noteId);
                    if (specialFilter === 'github' || specialFilter === 'consistency') setSpecialFilter('all');
                  }}
                  onSelectSpecialFilter={(filter) => {
                    setSpecialFilter(filter);
                    setSelectedFolderId(null);
                  }}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleOpenRenameFolderModal}
                  onCreateNote={handleCreateNote}
                  onMoveItem={handleOpenMoveModal}
                  onDeleteItem={handleRequestDelete}
                />
              </aside>
            )}

            {/* If Consistency Tracker Filter is active */}
            {specialFilter === 'consistency' ? (
              <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
                <ConsistencyWorkspace
                  onSyncVault={(updatedVault) => {
                    const strk = calculateStreak(updatedVault);
                    setConsistencyStreak(strk.currentStreak);
                    if (currentUser?.id) {
                      syncConsistencyVaultToFirestore(currentUser.id, updatedVault).catch(err => {
                        console.warn('Failed to sync Consistency vault:', err);
                      });
                    }
                  }}
                />
              </main>
            ) : specialFilter === 'github' ? (
              <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
                <GitHubTokenManager
                  credentials={githubCredentials}
                  onSaveCredential={handleSaveGitHubCredential}
                  onDeleteCredential={handleDeleteGitHubCredential}
                />
              </main>
            ) : (
              <>
                {/* PANE 2: SEARCHABLE NOTE LIST (Collapsible) */}
                {!focusMode && !isNoteListCollapsed && (
                  <section
                    style={{
                      width: 'var(--notes-list-w)',
                      flexShrink: 0,
                      borderRight: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-elevated)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <NoteList
                      title={noteListTitle}
                      folderColor={currentFolder?.color}
                      notes={getNotesForList()}
                      selectedNoteId={selectedNoteId}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      onSelectNote={(noteId) => setSelectedNoteId(noteId)}
                      onCreateNote={() => handleCreateNote(selectedFolderId)}
                      onDeleteNote={handleRequestDelete}
                    />
                  </section>
                )}

                {/* PANE 3: SELECTED NOTE RICH EDITOR (Main Canvas) */}
                <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
                  {selectedNote ? (
                    <RichEditor
                      note={selectedNote}
                      breadcrumbs={breadcrumbs}
                      childNotes={childNotes}
                      localSaveState={localSaveState}
                      cloudSyncState={cloudSyncState}
                      onUpdateNote={handleUpdateNote}
                      onNavigateBreadcrumb={(id) => {
                        if (id) {
                          const target = items.find(i => i.id === id);
                          if (target?.kind === 'note') setSelectedNoteId(id);
                          else setSelectedFolderId(id);
                        } else {
                          setSelectedFolderId(null);
                        }
                      }}
                      onSelectChildNote={(id) => setSelectedNoteId(id)}
                      onCreateChildNote={handleCreateChildNote}
                      onAttachAsset={handleAttachAsset}
                      onDeleteAsset={handleDeleteAsset}
                      onSaveAnnotation={handleSaveAnnotation}
                      onDeleteNote={handleRequestDelete}
                      isMobile={isMobile}
                    />
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', color: 'var(--text-tertiary)' }}>
                      <IconNote size={48} />
                      <p style={{ fontWeight: 600 }}>No note selected</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleCreateNote(selectedFolderId)}>
                        + Create New Note
                      </button>
                    </div>
                  )}
                </main>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Exit Mobile Preview Button (if simulated on desktop) */}
      {previewMobileMode && !isMobileScreen && (
        <button
          type="button"
          className="btn btn-sm"
          style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 9999,
            background: 'var(--card-dark-accent)',
            color: 'var(--card-dark-text)',
            boxShadow: 'var(--shadow-float)'
          }}
          onClick={() => setPreviewMobileMode(false)}
        >
          Exit Phone View
        </button>
      )}

      {/* MODAL: CYCLE-SAFE MOVE ITEM */}
      <MoveItemModal
        isOpen={isMoveModalOpen}
        movingItemId={movingItemId}
        items={items}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingItemId(null);
        }}
        onConfirmMove={handleConfirmMove}
      />

      {/* MODAL: SYNC CONFLICT RESOLUTION */}
      <ConflictModal
        conflict={syncConflict}
        onResolve={handleResolveConflict}
        onDismiss={() => setSyncConflict(null)}
      />

      {/* MODAL: SYNC, ACCOUNTS, APPEARANCE, BACKUP & MIGRATION */}
      <SyncSettingsModal
        isOpen={isSettingsModalOpen}
        currentUser={currentUser}
        currentTheme={theme}
        stats={{
          notesCount: items.filter(i => i.kind === 'note' && !i.isDeleted).length,
          foldersCount: items.filter(i => i.kind === 'folder' && !i.isDeleted).length,
          assetsCount: items.reduce((acc, n) => acc + (n.assetIds?.length || 0), 0)
        }}
        onClose={() => setIsSettingsModalOpen(false)}
        onThemeChange={handleThemeChange}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
        onRefreshData={async () => {
          const all = await dbGetAllItems(true);
          setItems(all);
          const first = all.find(i => i.kind === 'note' && !i.isDeleted);
          if (first) setSelectedNoteId(first.id);
        }}
        onShowToast={showToast}
      />

      {/* MODAL: CREATE & RENAME/CUSTOMIZE FOLDER */}
      <FolderModal
        isOpen={isFolderModalOpen}
        mode={folderModalMode}
        parentId={folderModalParentId}
        folderToEdit={folderToEdit}
        items={items}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderToEdit(null);
        }}
        onSubmit={handleFolderModalSubmit}
      />

      {/* MODAL: SAFE CONFIRMATION FOR MOVING TO TRASH */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        itemToDelete={itemToDelete}
        items={items}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Floating Active Focus Timer Bar across all views */}
      <FocusTimerFloatingBar
        onOpenFocusView={() => {
          setSpecialFilter('consistency');
          setSelectedFolderId(null);
        }}
      />
    </div>
  );
};

export default App;
