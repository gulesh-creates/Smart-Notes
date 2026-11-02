import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Item,
  Asset,
  MediaAnnotationRecord,
  SyncConflict,
  UserAccount,
  buildBreadcrumbPath,
  wouldCreateCycle,
  getDescendantIds
} from '@smartnotes/shared';
import {
  IconSettings, IconPlus, IconFolder, IconNote, IconSync,
  IconSun, IconMoon, IconCheck, IconBack, IconClose,
  IconSearch, IconPin, IconTrash, IconUndo, IconConflict, IconMonitor
} from './components/icons/Icons';
import { TreeRail } from './components/navigation/TreeRail';
import { NoteList } from './components/navigation/NoteList';
import { RichEditor } from './components/editor/RichEditor';
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
  dbRemoveOutboxMutations
} from './storage/db';
import {
  firebaseAuthenticate,
  firebaseSignOut,
  syncItemToFirestore,
  deleteItemInFirestore,
  fetchItemsFromFirestore
} from './firebase/firebase';

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
  const [specialFilter, setSpecialFilter] = useState<'all' | 'pinned' | 'recent' | 'trash'>('all');
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

  // 1. Initial Load & Seed
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load theme
        const savedTheme = await dbGetSetting<'light' | 'dark' | 'system'>('app_theme', 'light');
        setTheme(savedTheme);
        applyTheme(savedTheme);

        // Load auth token & profile
        const token = await dbGetSetting<string | null>('auth_token', null);
        const savedUserStr = await dbGetSetting<string | null>('auth_user', null);
        if (token) {
          setAuthToken(token);
          if (savedUserStr) {
            try {
              setCurrentUser(JSON.parse(savedUserStr));
            } catch {
              fetchCurrentUser(token);
            }
          } else {
            fetchCurrentUser(token);
          }
        }

        // Load items from IndexedDB
        let storedItems = await dbGetAllItems(true);
        if (!storedItems || storedItems.length === 0) {
          // First launch seed
          storedItems = INITIAL_SAMPLE_ITEMS;
          await dbSaveItemsBatch(storedItems);
          const sampleAssets = createInitialSampleAssets();
          for (const a of sampleAssets) {
            await dbSaveAsset(a);
          }
        } else {
          // Ensure sample assets exist
          const sampleAssets = createInitialSampleAssets();
          for (const a of sampleAssets) {
            const existing = await dbGetAsset(a.id);
            if (!existing) {
              await dbSaveAsset(a);
            }
          }
        }

        setItems(storedItems);

        // Select first active note
        const firstNote = storedItems.find(i => i.kind === 'note' && !i.isDeleted);
        if (firstNote) {
          setSelectedNoteId(firstNote.id);
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
    return () => window.removeEventListener('resize', handleResize);
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

  // Auth Helpers
  const fetchCurrentUser = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setAuthToken(null);
        await dbSetSetting('auth_token', null);
      }
    } catch {
      // Offline
      setCloudSyncState('offline');
    }
  };

  const handleLogin = async (email: string, pass: string) => {
    // 1. Authenticate with Firebase Auth
    try {
      const fbUser = await firebaseAuthenticate(email, pass);
      setAuthToken(fbUser.id);
      setCurrentUser(fbUser);
      await dbSetSetting('auth_token', fbUser.id);
      await dbSetSetting('auth_user', JSON.stringify(fbUser));
      showToast(`Welcome back, ${fbUser.displayName}!`);

      // Sync items with Firestore
      try {
        const remoteItems = await fetchItemsFromFirestore(fbUser.id);
        if (remoteItems && remoteItems.length > 0) {
          await dbSaveItemsBatch(remoteItems);
          const all = await dbGetAllItems(true);
          setItems(all);
        } else {
          const localItems = await dbGetAllItems(true);
          for (const item of localItems) {
            await syncItemToFirestore(fbUser.id, item);
          }
        }
      } catch (syncErr) {
        console.warn('Firestore initial sync warning:', syncErr);
      }

      setCloudSyncState('synced');
      return;
    } catch (fbErr: any) {
      console.warn('Firebase login attempt fallback:', fbErr?.message || fbErr);
    }

    // Fallback to Express backend if Firebase auth was not reachable
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setAuthToken(data.token);
    setCurrentUser(data.user);
    await dbSetSetting('auth_token', data.token);
    await dbSetSetting('auth_user', JSON.stringify(data.user));
    showToast(`Welcome back, ${data.user.displayName}!`);
    triggerSync();
  };

  const handleRegister = async (email: string, pass: string, name: string) => {
    // 1. Authenticate / Register with Firebase Auth
    try {
      const fbUser = await firebaseAuthenticate(email, pass, name);
      setAuthToken(fbUser.id);
      setCurrentUser(fbUser);
      await dbSetSetting('auth_token', fbUser.id);
      await dbSetSetting('auth_user', JSON.stringify(fbUser));
      showToast(`Account created for ${fbUser.displayName}!`);

      const localItems = await dbGetAllItems(true);
      for (const item of localItems) {
        await syncItemToFirestore(fbUser.id, item);
      }
      setCloudSyncState('synced');
      return;
    } catch (fbErr: any) {
      console.warn('Firebase register attempt fallback:', fbErr?.message || fbErr);
    }

    // Fallback to Express backend
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, displayName: name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setAuthToken(data.token);
    setCurrentUser(data.user);
    await dbSetSetting('auth_token', data.token);
    await dbSetSetting('auth_user', JSON.stringify(data.user));
    showToast(`Account created for ${data.user.displayName}!`);
    triggerSync();
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setCurrentUser(null);
    await dbSetSetting('auth_token', null);
    await dbSetSetting('auth_user', null);
    await firebaseSignOut();
    showToast('Signed out of cloud sync.');
  };

  // Background Sync Loop
  const triggerSync = useCallback(async () => {
    if (!authToken) {
      setCloudSyncState('offline');
      return;
    }

    try {
      setCloudSyncState('pending');
      const mutations = await dbGetOutboxMutations();

      // Push mutations
      if (mutations.length > 0) {
        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ mutations })
        });

        if (pushRes.ok) {
          const pushData = await pushRes.json();
          if (pushData.conflicts && pushData.conflicts.length > 0) {
            setSyncConflict(pushData.conflicts[0]);
            setCloudSyncState('conflict');
            return;
          }
          if (pushData.appliedOpIds) {
            await dbRemoveOutboxMutations(pushData.appliedOpIds);
          }
        }
      }

      // Pull updates
      const lastCursor = await dbGetSetting<number>('sync_cursor', 0);
      const pullRes = await fetch(`/api/sync/pull?cursor=${lastCursor}&limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (pullRes.ok) {
        const pullData = await pullRes.json();
        if (pullData.items && pullData.items.length > 0) {
          await dbSaveItemsBatch(pullData.items);
          const all = await dbGetAllItems(true);
          setItems(all);
        }
        await dbSetSetting('sync_cursor', pullData.nextCursor);
      }

      setCloudSyncState('synced');
    } catch {
      setCloudSyncState('offline');
    }
  }, [authToken]);

  useEffect(() => {
    const interval = setInterval(triggerSync, 20000);
    return () => clearInterval(interval);
  }, [triggerSync]);

  // Persistent Database & Cloud Sync Helper
  const persistItem = async (item: Item, queueForSync = true) => {
    await dbSaveItem(item, queueForSync);
    if (currentUser?.id) {
      syncItemToFirestore(currentUser.id, item).catch(err => {
        console.warn('Firestore sync warning:', err);
      });
    }
  };

  // Note Selection & Editing
  const selectedNote = items.find(i => i.id === selectedNoteId && !i.isDeleted) || null;

  const handleUpdateNote = (updated: Partial<Item>) => {
    if (!selectedNoteId) return;

    setLocalSaveState('saving');
    const now = Date.now();

    setItems(prev => {
      const next = prev.map(item => {
        if (item.id === selectedNoteId) {
          return {
            ...item,
            ...updated,
            version: item.version + 1,
            updatedAt: now
          };
        }
        return item;
      });

      const updatedItem = next.find(i => i.id === selectedNoteId);
      if (updatedItem) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            await persistItem(updatedItem, true);
            setLocalSaveState('saved');
            if (authToken) triggerSync();
          } catch (e) {
            console.error('Failed to autosave note:', e);
            setLocalSaveState('error');
          }
        }, 400);
      }

      return next;
    });
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
      await dbMarkItemDeleted(id);
      if (currentUser?.id) {
        deleteItemInFirestore(currentUser.id, id).catch(() => {});
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
    let base = items.filter(i => i.kind === 'note');

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
          onSelectNote={(id) => setSelectedNoteId(id)}
          onUpdateNote={handleUpdateNote}
          onCreateNote={handleCreateNote}
          onCreateFolder={handleCreateFolder}
          onCreateChildNote={handleCreateChildNote}
          onAttachAsset={handleAttachAsset}
          onDeleteAsset={handleDeleteAsset}
          onSaveAnnotation={handleSaveAnnotation}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
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
                  onSelectFolder={(folderId) => {
                    setSelectedFolderId(folderId);
                    setSpecialFilter('all');
                  }}
                  onSelectNote={(noteId) => setSelectedNoteId(noteId)}
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
    </div>
  );
};

export default App;
