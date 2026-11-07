import React, { useEffect, useState } from 'react';
import { ConsistencyVault, ConsistencyActivity } from '@smartnotes/shared';
import { focusTimerEngine, FocusTimerSnapshot, STAGE_CONFIG } from './FocusTimerEngine';
import { getScheduledActivitiesForDate, getLocalDateKey } from '../../storage/consistencyDb';
import { IconPlay, IconPause, IconCheckCircle, IconSkip, IconTarget, IconFlame } from '../icons/Icons';
import {
  AVAILABLE_TIMER_TONES,
  getSavedTimerTone,
  saveTimerTone,
  playTimerTone
} from './timerAudio';

export interface FocusTimerViewProps {
  vault: ConsistencyVault;
  selectedActivityId?: string | null;
  onSessionFinished?: () => void;
}

export const FocusTimerView: React.FC<FocusTimerViewProps> = ({
  vault,
  selectedActivityId,
  onSessionFinished
}) => {
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot>(focusTimerEngine.getSnapshot());
  const [chosenActivityId, setChosenActivityId] = useState<string>(
    selectedActivityId || snapshot.activityId || (vault.activities[0]?.id ?? '')
  );
  const [currentTone, setCurrentTone] = useState<string>(() => getSavedTimerTone());

  useEffect(() => {
    return focusTimerEngine.subscribe(setSnapshot);
  }, []);

  useEffect(() => {
    if (selectedActivityId) {
      setChosenActivityId(selectedActivityId);
    }
  }, [selectedActivityId]);

  const handleToneChange = (toneId: string) => {
    setCurrentTone(toneId);
    saveTimerTone(toneId);
  };

  const handleTestSound = () => {
    playTimerTone(currentTone);
  };

  const todayKey = getLocalDateKey();
  const scheduled = getScheduledActivitiesForDate(vault, todayKey);
  const activeActivities = vault.activities.filter(a => !a.isArchived && !a.isPaused);

  // If session is running or paused, use its active activity; otherwise use selected activity
  const currentActivityId = snapshot.activityId || chosenActivityId;
  const currentActivity = vault.activities.find(a => a.id === currentActivityId);
  const currentCategory = currentActivity
    ? vault.categories.find(c => c.id === currentActivity.categoryId)
    : null;

  const mins = Math.floor(snapshot.stageRemainingSeconds / 60);
  const secs = snapshot.stageRemainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const isRunning = snapshot.status === 'FOCUS_RUNNING' || snapshot.status === 'BREAK_RUNNING';
  const isPaused = snapshot.status === 'FOCUS_PAUSED' || snapshot.status === 'BREAK_PAUSED';
  const isCheckpoint = snapshot.status === 'FOCUS_CHECKPOINT';
  const isBreak = snapshot.stage === 'break';
  const isIdle = snapshot.status === 'IDLE' || snapshot.status === 'SESSION_COMPLETED';

  // Progress fraction
  const totalStageSec = snapshot.stageDurationSeconds || STAGE_CONFIG[1];
  const progressPercent = Math.min(100, Math.round((snapshot.stageElapsedSeconds / totalStageSec) * 100));

  const handleStart = () => {
    if (!currentActivity) return;
    focusTimerEngine.startSession(
      currentActivity.id,
      currentActivity.title,
      currentCategory?.name || 'General',
      todayKey
    );
  };

  const handleFinish = async () => {
    await focusTimerEngine.finishSession();
    if (onSessionFinished) onSessionFinished();
  };

  return (
    <div
      className="focus-timer-workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        maxWidth: '720px',
        margin: '0 auto',
        width: '100%',
        minHeight: '70vh'
      }}
    >
      {/* Activity Selector (when idle) or Active Activity Header */}
      {isIdle ? (
        <div style={{ width: '100%', maxWidth: '480px', marginBottom: '24px', textAlign: 'center' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px'
            }}
          >
            Select Priority Activity to Focus
          </label>
          <select
            className="input"
            value={chosenActivityId}
            onChange={(e) => setChosenActivityId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1.5px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {activeActivities.map(act => {
              const cat = vault.categories.find(c => c.id === act.categoryId);
              return (
                <option key={act.id} value={act.id}>
                  {act.title} ({act.minMinutes}m target) — {cat?.name || 'General'}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: currentCategory?.color ? `${currentCategory.color}22` : 'var(--bg-surface-subtle)',
              border: `1px solid ${currentCategory?.color || 'var(--border-subtle)'}`,
              marginBottom: '8px'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: currentCategory?.color || 'var(--lime-primary)'
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {snapshot.categoryName || currentCategory?.name || 'Priority Activity'}
            </span>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            {snapshot.activityTitle || currentActivity?.title}
          </h2>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            {isBreak
              ? 'Recovery period: Breathe, stretch, hydrate 🧘'
              : `Accumulated focused time this session: ${Math.round(snapshot.accumulatedFocusedSeconds / 60)} min`}
          </p>
        </div>
      )}

      {/* 4-Stage Progressive Cycle Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          maxWidth: '460px',
          marginBottom: '32px',
          padding: '10px 16px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        {[
          { num: 1, label: '5m Starter' },
          { num: 2, label: '10m Flow' },
          { num: 3, label: '10m Deep' },
          { num: 'break', label: '5m Rest' }
        ].map((st, i) => {
          const isActive = snapshot.stage === st.num;
          const isDone = typeof st.num === 'number' && snapshot.stagesCompleted >= st.num;

          return (
            <React.Fragment key={st.label}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: isDone
                      ? 'var(--lime-primary)'
                      : isActive
                      ? 'var(--lime-pale)'
                      : 'var(--bg-surface-subtle)',
                    color: isDone || isActive ? 'var(--text-on-lime)' : 'var(--text-tertiary)',
                    border: isActive ? '2px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                    boxShadow: isActive ? '0 0 10px var(--lime-glow)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {isDone ? '✓' : st.num === 'break' ? '☕' : st.num}
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: isActive ? 800 : 500,
                    color: isActive ? 'var(--text-main)' : 'var(--text-tertiary)'
                  }}
                >
                  {st.label}
                </span>
              </div>
              {i < 3 && (
                <div
                  style={{
                    width: '12px',
                    height: '2px',
                    background: isDone ? 'var(--lime-primary)' : 'var(--border-subtle)'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Countdown Timer Clock */}
      <div
        style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface)',
          border: isCheckpoint
            ? '4px solid var(--lime-primary)'
            : isBreak
            ? '4px solid #38BDF8'
            : isRunning
            ? '4px solid var(--lime-primary)'
            : '4px solid var(--border-medium)',
          boxShadow: isRunning ? '0 0 32px var(--lime-glow)' : 'var(--shadow-md)',
          marginBottom: '36px',
          transition: 'all 0.3s ease'
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isBreak ? '#38BDF8' : isCheckpoint ? 'var(--lime-primary)' : 'var(--text-tertiary)',
            marginBottom: '4px'
          }}
        >
          {isBreak
            ? 'Rest Break'
            : isCheckpoint
            ? 'Stage Complete!'
            : isIdle
            ? 'Stage 1: Starter'
            : `Stage ${snapshot.stage}: Focused Work`}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '4.2rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            lineHeight: 1
          }}
        >
          {timeFormatted}
        </span>

        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginTop: '8px'
          }}
        >
          {isPaused
            ? 'Paused'
            : isCheckpoint
            ? 'Waiting for your action'
            : isRunning
            ? 'Stay focused on 1 task'
            : '5-minute micro commitment'}
        </span>
      </div>

      {/* Checkpoint Banner and Action Buttons */}
      {isCheckpoint && (
        <div
          style={{
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-surface-elevated)',
            border: '2px solid var(--lime-primary)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            textAlign: 'center',
            marginBottom: '24px',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
            {snapshot.stage === 3 ? '🎉' : '🎯'}
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            {snapshot.stage === 3 ? 'Focus Cycle Complete (25 min)!' : `Checkpoint Reached (${Math.round(snapshot.accumulatedFocusedSeconds / 60)}m)`}
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
            {snapshot.stage === 3
              ? 'Phenomenal work! You completed a full 25-minute deep focus cycle. Take a 5-minute break to recharge.'
              : 'You overcame friction and completed your starter stage! Would you like to maintain momentum for +10 minutes?'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: 'var(--lime-primary)',
                color: 'var(--text-on-lime)',
                fontWeight: 800,
                padding: '12px 24px',
                borderRadius: 'var(--radius-pill)',
                boxShadow: '0 4px 14px var(--lime-glow)'
              }}
              onClick={() => {
                if (snapshot.stage === 3) {
                  focusTimerEngine.extendSession(10);
                } else {
                  focusTimerEngine.continueCheckpoint();
                }
              }}
            >
              Continue +10 Minutes 🔥
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-main)',
                fontWeight: 700,
                padding: '12px 20px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-medium)'
              }}
              onClick={() => focusTimerEngine.startBreak()}
            >
              ☕ Take 5-Minute Break
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-main)',
                fontWeight: 700,
                padding: '12px 20px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-medium)'
              }}
              onClick={handleFinish}
            >
              Finish Session & Save
            </button>
          </div>
        </div>
      )}

      {/* Break Controls */}
      {isBreak && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-main)',
              fontWeight: 700,
              padding: '10px 20px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-medium)'
            }}
            onClick={() => focusTimerEngine.skipBreak()}
          >
            <IconSkip size={16} /> Skip Break
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'var(--lime-primary)',
              color: 'var(--text-on-lime)',
              fontWeight: 800,
              padding: '10px 24px',
              borderRadius: 'var(--radius-pill)'
            }}
            onClick={() => focusTimerEngine.startAnotherCycle()}
          >
            Start Next Cycle
          </button>
        </div>
      )}

      {/* Primary Running / Idle Controls */}
      {!isCheckpoint && !isBreak && (
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          {isIdle ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: 'var(--lime-primary)',
                color: 'var(--text-on-lime)',
                fontWeight: 800,
                fontSize: '1.05rem',
                padding: '14px 36px',
                borderRadius: 'var(--radius-pill)',
                boxShadow: '0 6px 20px var(--lime-glow)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onClick={handleStart}
            >
              <IconPlay size={18} />
              Start Focus (5m Starter)
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1.5px solid var(--border-medium)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => {
                  if (isPaused) focusTimerEngine.resume();
                  else focusTimerEngine.pause();
                }}
              >
                {isPaused ? <IconPlay size={16} /> : <IconPause size={16} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-pill)'
                }}
                onClick={handleFinish}
              >
                Finish & Save ({Math.round((snapshot.accumulatedFocusedSeconds + snapshot.stageElapsedSeconds) / 60)}m)
              </button>
            </>
          )}
        </div>
      )}

      {/* Audio Completion Tone Settings Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          marginTop: '32px',
          padding: '16px 20px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
              🔔 Timer Completion Sound
            </span>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Synthesized tone played when focus intervals or breaks complete.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleTestSound}
            style={{ fontSize: '0.78rem', padding: '5px 12px', border: '1px solid var(--border-subtle)' }}
          >
            ▶ Test Sound
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {AVAILABLE_TIMER_TONES.map(tone => {
            const isSelected = tone.id === currentTone;
            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => {
                  handleToneChange(tone.id);
                  playTimerTone(tone.id);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: isSelected ? '1.5px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(218, 253, 75, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={tone.description}
              >
                {isSelected ? '✓ ' : ''}{tone.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

