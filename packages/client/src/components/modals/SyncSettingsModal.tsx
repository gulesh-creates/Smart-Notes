import React, { useState, useEffect } from 'react';
import { UserAccount } from '@smartnotes/shared';
import {
  IconSettings, IconSun, IconMoon, IconMonitor, IconExport,
  IconImport, IconSync, IconClose, IconCheck, IconTrash, IconFolder, IconNote
} from '../icons/Icons';
import { exportLibraryToZip, inspectZipBackupForRestore, applyRestoreFromZip, RestorePreview } from '../../export/archiveEngine';
import { detectPrototypeDatabase, migrateFromPrototypeDatabase, MigrationSummary } from '../../migration/prototypeMigration';
import { dbClearAllData } from '../../storage/db';

export interface SyncSettingsModalProps {
  isOpen: boolean;
  currentUser: UserAccount | null;
  currentTheme: 'light' | 'dark' | 'system';
  stats: { notesCount: number; foldersCount: number; assetsCount: number };
  onClose: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
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
  onLogin,
  onRegister,
  onLogout,
  onRefreshData,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'backup' | 'migration'>('account');
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('gulesh_creates');
  const [password, setPassword] = useState('6266100');
  const [displayName, setDisplayName] = useState('Gulesh');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Backup / Restore State
  const [exportProgress, setExportProgress] = useState<{ percent: number; msg: string } | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Prototype Migration State
  const [hasPrototypeDb, setHasPrototypeDb] = useState(false);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      detectPrototypeDatabase().then(setHasPrototypeDb);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        await onLogin(email, password);
        onShowToast('Signed in successfully');
      } else {
        await onRegister(email, password, displayName);
        onShowToast('Account registered and signed in');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
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

  const handleMigratePrototype = async () => {
    setIsMigrating(true);
    try {
      const summary = await migrateFromPrototypeDatabase();
      setMigrationSummary(summary);
      onRefreshData();
      onShowToast(`Migrated ${summary.notesMigrated} notes & ${summary.assetsMigrated} documents!`);
    } catch (err: any) {
      alert('Migration failed: ' + err.message);
    } finally {
      setIsMigrating(false);
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
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSettings size={18} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Settings & Cloud Sync</h3>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="settings-modal-tabs"
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
            { id: 'backup', label: 'Export & Restore' },
            { id: 'migration', label: 'Prototype Data' }
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
          {/* TAB 1: ACCOUNT & SYNC */}
          {activeTab === 'account' && (
            <div>
              {currentUser ? (
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>{currentUser.displayName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{currentUser.email}</div>
                    </div>
                    <span className="badge badge-lime">Signed In</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Your notes are automatically synced with the cloud. All edits continue to work completely offline.
                  </p>
                  <button type="button" className="btn btn-sm" onClick={onLogout} style={{ color: 'var(--danger)' }}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${authMode === 'login' ? 'btn-primary' : ''}`}
                      onClick={() => setAuthMode('login')}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${authMode === 'register' ? 'btn-primary' : ''}`}
                      onClick={() => setAuthMode('register')}
                    >
                      Create Account
                    </button>
                  </div>

                  {authError && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '14px' }}>
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {authMode === 'register' && (
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name</label>
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          placeholder="Your Name"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', fontSize: '0.86rem' }}
                        />
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Username or Email</label>
                        <button
                          type="button"
                          onClick={() => { setEmail('gulesh_creates'); setPassword('6266100'); }}
                          style={{
                            border: 'none',
                            background: 'var(--lime-pale)',
                            color: '#12241A',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            cursor: 'pointer'
                          }}
                        >
                          Auto-fill gulesh_creates
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="gulesh_creates or name@example.com"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', fontSize: '0.86rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', fontSize: '0.86rem' }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ marginTop: '8px' }}>
                      {authLoading ? 'Connecting to Firebase...' : authMode === 'login' ? 'Sign In & Enable Cloud Sync' : 'Register & Start Syncing'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Theme Preference</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Smart Notes defaults to a calm, high-contrast light theme with selective lime green highlights, alongside a designed companion dark mode.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                  { id: 'light', label: 'Light (Default)', icon: <IconSun size={18} /> },
                  { id: 'dark', label: 'Dark Mode', icon: <IconMoon size={18} /> },
                  { id: 'system', label: 'System Default', icon: <IconMonitor size={18} /> }
                ].map(th => {
                  const isCurrent = currentTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      style={{
                        padding: '16px 12px',
                        border: isCurrent ? '2px solid var(--lime-primary)' : '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        background: isCurrent ? 'var(--lime-pale)' : 'var(--bg-surface-elevated)',
                        color: isCurrent ? '#12241A' : 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 600,
                        fontSize: '0.82rem'
                      }}
                      onClick={() => onThemeChange(th.id as any)}
                    >
                      {th.icon}
                      <span>{th.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Design System Reference Card */}
              <div style={{ background: 'var(--card-dark-accent)', color: 'var(--card-dark-text)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--lime-primary)', textTransform: 'uppercase' }}>Reference Image 3 Palette</div>
                <div style={{ fontSize: '0.84rem', marginTop: '4px', opacity: 0.9 }}>
                  White canvas, dark forest cards, selective lime action buttons, 100% custom SVG icons.
                </div>
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
                          Found: {restorePreview.folderCount} folders, {restorePreview.noteCount} notes, {restorePreview.assetCount} attachments.
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={handleApplyRestore} disabled={restoreLoading}>
                          <IconImport size={14} />
                          {restoreLoading ? 'Applying Restore...' : 'Confirm Restore into Library'}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
                        {restorePreview.warnings.join('; ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROTOTYPE MIGRATION */}
          {activeTab === 'migration' && (
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Prototype Data Importer</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Safely moves existing folders, notes, and documents from the single-file prototype (SmartNotesDB_v1) into the production database. Separates base64 data into binary blobs without erasing prototype data.
              </p>

              {hasPrototypeDb ? (
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--lime-border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--lime-primary)', marginBottom: '4px' }}>
                    Prototype Database Detected (SmartNotesDB_v1)
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Click below to migrate your existing notes, folder tree, and Kyoto trip data into the new schema.
                  </p>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleMigratePrototype} disabled={isMigrating}>
                    {isMigrating ? 'Migrating Data...' : 'Migrate Prototype Data'}
                  </button>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  No existing SmartNotesDB_v1 database found in this browser origin. You can also import prototype ZIP backups via the "Export & Restore" tab.
                </div>
              )}

              {migrationSummary && (
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Migration Summary</div>
                  <div>Folders migrated: {migrationSummary.foldersMigrated}</div>
                  <div>Notes migrated: {migrationSummary.notesMigrated}</div>
                  <div>Attachments converted: {migrationSummary.assetsMigrated}</div>
                  {migrationSummary.errors.length > 0 && (
                    <div style={{ color: 'var(--danger)', marginTop: '4px' }}>
                      Errors: {migrationSummary.errors.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>Danger Zone</div>
                <button type="button" className="btn btn-sm" onClick={handleResetData} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <IconTrash size={14} />
                  Reset All Local Data
                </button>
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

