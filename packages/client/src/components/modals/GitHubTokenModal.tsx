import React, { useState, useEffect } from 'react';
import { GitHubCredential } from '@smartnotes/shared';
import { IconGitHub, IconClose, IconKey, IconClock, IconEye, IconEyeOff } from '../icons/Icons';

export interface GitHubTokenModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: GitHubCredential | null;
  onClose: () => void;
  onSave: (data: {
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
  }) => void;
}

type ExpiryPreset = '7d' | '30d' | '60d' | '90d' | 'custom' | 'never';

export const GitHubTokenModal: React.FC<GitHubTokenModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSave
}) => {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<ExpiryPreset>('30d');
  const [customDateTime, setCustomDateTime] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setUsername(initialData.username || '');
        setToken(initialData.token || '');
        setLabel(initialData.label || '');
        if (initialData.expiresAt === null) {
          setPreset('never');
          setCustomDateTime('');
        } else {
          setPreset('custom');
          const d = new Date(initialData.expiresAt);
          // format local datetime for input
          const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setCustomDateTime(iso);
        }
      } else {
        setUsername('');
        setToken('');
        setLabel('');
        setPreset('30d');
        setCustomDateTime('');
      }
      setShowToken(false);
      setError(null);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  // Calculate actual expiresAt in epoch ms based on selection
  const calculateExpiresAt = (): number | null => {
    const now = Date.now();
    if (preset === 'never') return null;
    if (preset === '7d') return now + 7 * 86400000;
    if (preset === '30d') return now + 30 * 86400000;
    if (preset === '60d') return now + 60 * 86400000;
    if (preset === '90d') return now + 90 * 86400000;
    if (preset === 'custom') {
      if (!customDateTime) return null;
      const parsed = new Date(customDateTime).getTime();
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const currentExpiresAt = calculateExpiresAt();

  const formatPreviewDate = (timestamp: number | null): string => {
    if (timestamp === null) {
      return preset === 'custom' && !customDateTime
        ? 'Please select a custom expiration date & time'
        : 'Token will never expire';
    }
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const diffDays = Math.round((timestamp - Date.now()) / 86400000);
    const relativeText = diffDays > 0 ? `in ${diffDays} days` : 'today';

    return `Expires on ${dateStr} at ${timeStr} (${relativeText})`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    const cleanToken = token.trim();

    if (!cleanUsername) {
      setError('GitHub username is required.');
      return;
    }
    if (!cleanToken) {
      setError('Personal Access Token is required.');
      return;
    }

    if (preset === 'custom' && !customDateTime) {
      setError('Please select an expiration date or choose a preset.');
      return;
    }

    onSave({
      username: cleanUsername,
      token: cleanToken,
      label: label.trim() || undefined,
      expiresAt: currentExpiresAt
    });
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 12, 0.72)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '520px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#24292e',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconGitHub size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {mode === 'create' ? 'Add GitHub Account & Token' : 'Edit GitHub Credential'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Saved locally and synchronized with your secure cloud vault
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#ef4444',
                fontSize: '0.84rem',
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}

          {/* Account Label / Scope (Optional) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Account Label / Purpose <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span>
            </label>
            <input
              type="text"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Personal Main, Work Org, Vercel Deploy Bot"
              style={{ width: '100%' }}
            />
          </div>

          {/* GitHub Username */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              GitHub Username <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                @
              </span>
              <input
                type="text"
                className="input"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. gulesh-creates"
                style={{ width: '100%', paddingLeft: '30px' }}
                autoFocus
              />
            </div>
          </div>

          {/* GitHub Personal Access Token */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Personal Access Token (PAT) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', gap: '4px' }}
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                className="input"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                style={{
                  width: '100%',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.85rem',
                  letterSpacing: showToken ? 'normal' : '0.1em'
                }}
              />
            </div>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
              Generate via GitHub: Settings &gt; Developer settings &gt; Personal access tokens.
            </p>
          </div>

          {/* Token Expiration Duration ("Kitane dino me expire hogi") */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <IconClock size={15} />
              Token Expiration Period
            </label>

            {/* Expiry Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
              {(
                [
                  { id: '7d', label: '7 Days' },
                  { id: '30d', label: '30 Days' },
                  { id: '60d', label: '60 Days' },
                  { id: '90d', label: '90 Days' },
                  { id: 'custom', label: 'Custom Date' },
                  { id: 'never', label: 'No Expiration' }
                ] as { id: ExpiryPreset; label: string }[]
              ).map((p) => {
                const isSelected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${isSelected ? 'var(--lime-primary)' : 'var(--border-subtle)'}`,
                      background: isSelected ? 'rgba(185, 243, 42, 0.12)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Input */}
            {preset === 'custom' && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="datetime-local"
                  className="input"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {/* Dynamic Expiration Preview in English */}
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.76rem',
                color: preset === 'never' ? 'var(--text-secondary)' : 'var(--lime-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>●</span>
              <span>{formatPreviewDate(currentExpiresAt)}</span>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '4px'
            }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: 'var(--lime-primary)',
                color: '#000000',
                fontWeight: 700,
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <IconKey size={16} />
              {mode === 'create' ? 'Save Credential' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

