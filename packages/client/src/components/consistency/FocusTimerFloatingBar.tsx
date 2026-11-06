import React, { useEffect, useState } from 'react';
import { focusTimerEngine, FocusTimerSnapshot } from './FocusTimerEngine';
import { IconPlay, IconPause, IconTarget } from '../icons/Icons';

export interface FocusTimerFloatingBarProps {
  onOpenFocusView: () => void;
}

export const FocusTimerFloatingBar: React.FC<FocusTimerFloatingBarProps> = ({ onOpenFocusView }) => {
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot>(focusTimerEngine.getSnapshot());

  useEffect(() => {
    return focusTimerEngine.subscribe(setSnapshot);
  }, []);

  if (snapshot.status === 'IDLE' || snapshot.status === 'SESSION_COMPLETED') {
    return null;
  }

  const mins = Math.floor(snapshot.stageRemainingSeconds / 60);
  const secs = snapshot.stageRemainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isPaused = snapshot.status === 'FOCUS_PAUSED' || snapshot.status === 'BREAK_PAUSED';
  const isCheckpoint = snapshot.status === 'FOCUS_CHECKPOINT';
  const isBreak = snapshot.stage === 'break';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'var(--bg-surface-elevated)',
        border: '1.5px solid var(--lime-primary)',
        boxShadow: 'var(--shadow-float)',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onOpenFocusView}
      title="Click to open Focus Timer"
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: isPaused ? 'var(--warning)' : isCheckpoint ? 'var(--info)' : 'var(--lime-primary)',
          boxShadow: isPaused ? 'none' : '0 0 8px var(--lime-primary)'
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {snapshot.activityTitle || 'Focus Session'}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            {isBreak ? 'Rest' : isCheckpoint ? 'Checkpoint' : `Stage ${snapshot.stage}`}
          </span>
        </div>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 800,
          fontSize: '1rem',
          color: isCheckpoint ? 'var(--lime-primary)' : 'var(--text-main)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-xs)',
          background: 'var(--bg-card)'
        }}
      >
        {isCheckpoint ? 'Done!' : timeFormatted}
      </div>

      <div
        style={{ display: 'flex', gap: '4px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isCheckpoint && (
          <button
            type="button"
            className="btn btn-icon btn-sm"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--bg-surface-subtle)'
            }}
            onClick={() => {
              if (isPaused) focusTimerEngine.resume();
              else focusTimerEngine.pause();
            }}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <IconPlay size={12} /> : <IconPause size={12} />}
          </button>
        )}

        <button
          type="button"
          className="btn btn-icon btn-sm"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--lime-primary)',
            color: 'var(--text-on-lime)'
          }}
          onClick={onOpenFocusView}
          title="Open Focus Workspace"
        >
          <IconTarget size={14} />
        </button>
      </div>
    </div>
  );
};

