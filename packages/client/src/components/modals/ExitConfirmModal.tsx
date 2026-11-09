import React, { useState } from 'react';
import { IconClose, IconSync } from '../icons/Icons';

export interface ExitConfirmModalProps {
  isOpen: boolean;
  cloudSyncState: 'synced' | 'pending' | 'offline' | 'conflict' | 'error';
  onClose: () => void;
  onExit?: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  cloudSyncState,
  onClose,
  onExit
}) => {
  const [closeAttempted, setCloseAttempted] = useState(false);

  if (!isOpen) return null;

  const handleExit = () => {
    if (onExit) {
      onExit();
      return;
    }

    // 1. Electron environment
    if ((window as any).electronAPI?.quitApp) {
      (window as any).electronAPI.quitApp();
      return;
    }

    // 2. Web / PWA environment
    try {
      window.close();
      setCloseAttempted(true);
    } catch {
      setCloseAttempted(true);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(18, 36, 26, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
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
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                padding: '6px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444'
              }}
            >
              <IconClose size={18} />
            </span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Exit Smart Notes?
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close Modal"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Are you sure you want to exit <strong>Smart Notes</strong>?
          </p>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.84rem'
            }}
          >
            <span style={{ display: 'flex', color: cloudSyncState === 'pending' ? 'var(--warning, #f59e0b)' : 'var(--lime-primary)' }}>
              <IconSync size={16} />
            </span>
            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {cloudSyncState === 'pending'
                ? 'Cloud sync is in progress... You may wait a brief moment to ensure complete cloud synchronization.'
                : cloudSyncState === 'offline'
                ? 'Offline mode active: All your notes and consistency tracker data are safely saved locally on this device.'
                : 'All your notes, folders, and consistency tracker data are securely synced to the cloud.'}
            </span>
          </div>

          {closeAttempted && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(159, 232, 112, 0.15)',
                border: '1px solid var(--lime-primary)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                lineHeight: 1.4
              }}
            >
              Smart Notes is ready to close. You can now safely close this browser window or tab.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--bg-canvas)'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
            onClick={handleExit}
          >
            Exit Application
          </button>
        </div>
      </div>
    </div>
  );
};
