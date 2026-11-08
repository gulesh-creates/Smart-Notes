import React, { useState } from 'react';
import { UserAccount } from '@smartnotes/shared';
import {
  IconSun, IconMoon, IconMonitor, IconExport,
  IconClose, IconTrash
} from '../icons/Icons';
import { exportLibraryToZip, inspectZipBackupForRestore, applyRestoreFromZip, RestorePreview } from '../../export/archiveEngine';
import { dbClearAllData, dbGetAllItems, dbDeleteItem } from '../../storage/db';
import { isSampleOrPrototypeItem } from '../../sampleData';

export interface SyncSettingsModalProps {
  isOpen: boolean;
  currentUser: UserAccount | null;
  currentTheme: 'light' | 'dark' | 'system';
  stats: { notesCount: number; foldersCount: number; assetsCount: number };
  onClose: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => void;
  onRefreshData: () => void;
  onShowToast: (msg: string) => void;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  currentUser,
  currentTheme,
  stats,
  onClose,
  onThemeChange,
  onGoogleLogin,
  onLogout,
  onRefreshData,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'backup'>('account');

  // Google Auth State
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Backup / Restore State
  const [exportProgress, setExportProgress] = useState<{ percent: number; msg: string } | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await onGoogleLogin();
      onShowToast('Signed in successfully with Google');
    } catch (err: any) {
      setAuthError(err.message || 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    await onLogout();
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await exportLibraryToZip((pct, msg) => {
        setExportProgress({ percent: pct, msg });
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast(`Exported ${filename}`);
      setTimeout(() => setExportProgress(null), 2000);
    } catch (err: any) {
      setExportProgress(null);
      alert('Export failed: ' + err.message);
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    const preview = await inspectZipBackupForRestore(file);
    setRestorePreview(preview);
    e.target.value = '';
  };

  const handleApplyRestore = async () => {
    if (!restoreFile || !restorePreview?.manifest) return;
    setRestoreLoading(true);
    try {
      await applyRestoreFromZip(restoreFile, restorePreview.manifest, (pct, msg) => {
        setExportProgress({ percent: pct, msg });
      });
      setRestorePreview(null);
      setRestoreFile(null);
      setExportProgress(null);
      onRefreshData();
      onShowToast('Library restored successfully');
    } catch (err: any) {
      setExportProgress(null);
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handlePurgeSampleData = async () => {
    if (window.confirm('Purge all demo/prototype sample items from database and trash? Your personal notes will be kept safe.')) {
      const all = await dbGetAllItems(true);
      const toDelete = all.filter(i => isSampleOrPrototypeItem(i));
      for (const item of toDelete) {
        await dbDeleteItem(item.id);
      }
      onRefreshData();
      onShowToast(`Purged ${toDelete.length} sample/prototype items`);
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Wipe all local notes, folders, and documents? This cannot be undone.')) {
      await dbClearAllData();
      onRefreshData();
      onShowToast('All local data wiped');
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(18, 36, 26, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Settings & Cloud Account
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {stats.notesCount} personal note{stats.notesCount !== 1 ? 's' : ''} &bull; {stats.foldersCount} folder{stats.foldersCount !== 1 ? 's' : ''}
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-subtle)',
            padding: '0 8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            flexShrink: 0
          }}
        >
          {[
            { id: 'account', label: 'Cloud Account' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'backup', label: 'Export & Restore' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              style={{
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                fontSize: '0.82rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--lime-primary)' : '2px solid transparent',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: GOOGLE ACCOUNT & CLOUD SYNC */}
          {activeTab === 'account' && (
            <div>
              {currentUser ? (
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{currentUser.displayName}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{currentUser.email}</div>
                    </div>
                    <span className="badge badge-lime">Authorized Account</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    Your notes, attachments, and consistency tracker are automatically synced with Firebase cloud under this authorized account.
                  </p>
                  <button type="button" className="btn btn-sm" onClick={handleSignOut} style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Secure Gmail Sign-In
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      This Smart Notes workspace is private and strictly restricted. Only the authorized account <strong>gulesh.patel.csit@gmail.com</strong> can log in and access this data.
                    </p>

                    {authError && (
                      <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '16px' }}>
                        {authError}
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 18px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        borderRadius: '8px'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      {authLoading ? 'Connecting to Google...' : 'Sign in with Google (Gmail)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>Theme Preference</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  { id: 'light', label: 'Light', icon: IconSun },
                  { id: 'dark', label: 'Dark', icon: IconMoon },
                  { id: 'system', label: 'System', icon: IconMonitor }
                ].map(th => {
                  const Icon = th.icon;
                  const isSel = currentTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSel ? '2px solid var(--lime-primary)' : '1px solid var(--border-medium)',
                        background: isSel ? 'var(--bg-surface-subtle)' : 'var(--bg-surface-elevated)',
                        color: isSel ? 'var(--text-main)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: isSel ? 700 : 500
                      }}
                      onClick={() => onThemeChange(th.id as any)}
                    >
                      <Icon size={20} color={isSel ? 'var(--lime-primary)' : 'currentColor'} />
                      <span style={{ fontSize: '0.8rem' }}>{th.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT & RESTORE */}
          {activeTab === 'backup' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Full Library ZIP Export</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Downloads a complete ZIP archive preserving folder directories, child-note hierarchy, Markdown & HTML documents, attachments, and manifest.json.
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleExport}>
                  <IconExport size={14} />
                  Export All (ZIP)
                </button>
                {exportProgress && (
                  <div style={{ marginTop: '10px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    <div>{exportProgress.msg}</div>
                    <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${exportProgress.percent}%`, height: '100%', background: 'var(--lime-primary)' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Restore from Backup ZIP</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Validates archive paths against directory traversal (..), checks manifest version, and previews items before applying.
                </p>
                <input type="file" accept=".zip" onChange={handleRestoreFileSelected} style={{ fontSize: '0.82rem' }} />

                {restorePreview && (
                  <div style={{ marginTop: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: restorePreview.isValid ? 'var(--lime-primary)' : 'var(--danger)', marginBottom: '6px' }}>
                      {restorePreview.isValid ? 'Archive Verified Valid' : 'Archive Validation Failed'}
                    </div>
                    {restorePreview.isValid ? (
                      <>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          Ready to restore {restorePreview.manifest?.items?.length || 0} items and {restorePreview.manifest?.assets?.length || 0} binary documents.
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={handleApplyRestore} disabled={restoreLoading}>
                          {restoreLoading ? 'Applying Restore...' : 'Apply Restore'}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.76rem', color: 'var(--danger)' }}>
                        {restorePreview.warnings.join('; ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px' }}>Danger Zone</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm" onClick={handlePurgeSampleData} style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}>
                    <IconTrash size={14} />
                    Purge All Demo/Sample Data
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleResetData} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    <IconTrash size={14} />
                    Reset All Local Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-surface-subtle)' }}>
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
