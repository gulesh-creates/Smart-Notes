import { ConsistencyVault } from '@smartnotes/shared';
import { dbRecordFocusSession, getLocalDateKey } from '../../storage/consistencyDb';
import { playTimerTone } from './timerAudio';

export type FocusTimerStage = 1 | 2 | 3 | 'break';

export type FocusTimerStatus =
  | 'IDLE'
  | 'FOCUS_RUNNING'
  | 'FOCUS_PAUSED'
  | 'FOCUS_CHECKPOINT'
  | 'BREAK_RUNNING'
  | 'BREAK_PAUSED'
  | 'SESSION_COMPLETED';

export interface FocusTimerSnapshot {
  sessionId: string;
  activityId: string;
  activityTitle: string;
  categoryName: string;
  dateKey: string;
  status: FocusTimerStatus;
  stage: FocusTimerStage;
  stageDurationSeconds: number;
  stageRemainingSeconds: number;
  stageElapsedSeconds: number;
  stageStartTimestamp: number;
  stageDeadlineTimestamp: number;
  accumulatedFocusedSeconds: number;
  accumulatedBreakSeconds: number;
  pausedRemainingSeconds: number;
  lastPersistedTimestamp: number;
  stagesCompleted: number; // e.g. 1, 2, 3
}

const STORAGE_KEY = 'sn_focus_timer_active_session';

// Stage durations in seconds
export const STAGE_CONFIG = {
  1: 5 * 60,      // 5 min starter
  2: 10 * 60,     // 10 min expansion
  3: 10 * 60,     // 10 min deep focus (25 min total)
  break: 5 * 60   // 5 min rest
};

// Safe cross-platform storage helpers
const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {}
  return null;
};

const setStorageItem = (key: string, val: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch (e) {}
};

const removeStorageItem = (key: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (e) {}
};

// Play synthesized timer completion tone
export function playChimeSound() {
  try {
    playTimerTone();
  } catch (err) {
    console.warn('Audio chime notice:', err);
  }
}

// Request and trigger browser notification if supported and granted
export function showTimerNotification(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    }
  } catch (err) {
    console.warn('Notification notice:', err);
  }
}

class FocusTimerEngine {
  private current: FocusTimerSnapshot = this.getInitialSnapshot();
  private intervalId: number | null = null;
  private listeners: Set<(snapshot: FocusTimerSnapshot) => void> = new Set();
  private sessionSavedListeners: Set<(vault: ConsistencyVault) => void> = new Set();

  constructor() {
    this.restoreSession();
  }

  private getInitialSnapshot(): FocusTimerSnapshot {
    return {
      sessionId: '',
      activityId: '',
      activityTitle: '',
      categoryName: '',
      dateKey: getLocalDateKey(),
      status: 'IDLE',
      stage: 1,
      stageDurationSeconds: STAGE_CONFIG[1],
      stageRemainingSeconds: STAGE_CONFIG[1],
      stageElapsedSeconds: 0,
      stageStartTimestamp: 0,
      stageDeadlineTimestamp: 0,
      accumulatedFocusedSeconds: 0,
      accumulatedBreakSeconds: 0,
      pausedRemainingSeconds: 0,
      lastPersistedTimestamp: Date.now(),
      stagesCompleted: 0
    };
  }

  public getSnapshot(): FocusTimerSnapshot {
    return { ...this.current };
  }

  public subscribe(listener: (snapshot: FocusTimerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeSessionSaved(listener: (vault: ConsistencyVault) => void): () => void {
    this.sessionSavedListeners.add(listener);
    return () => {
      this.sessionSavedListeners.delete(listener);
    };
  }

  private notifySessionSaved(vault: ConsistencyVault) {
    this.sessionSavedListeners.forEach(fn => {
      try {
        fn(vault);
      } catch (e) {
        console.warn('Focus timer session saved listener error:', e);
      }
    });
  }

  private notify() {
    const snap = this.getSnapshot();
    this.persistSession();
    this.listeners.forEach(fn => fn(snap));
  }

  private persistSession() {
    try {
      if (this.current.status === 'IDLE' || this.current.status === 'SESSION_COMPLETED') {
        removeStorageItem(STORAGE_KEY);
      } else {
        setStorageItem(STORAGE_KEY, JSON.stringify(this.current));
      }
    } catch (e) {
      // Storage error
    }
  }

  private restoreSession() {
    try {
      const raw = getStorageItem(STORAGE_KEY);
      if (!raw) return;
      const saved: FocusTimerSnapshot = JSON.parse(raw);
      if (!saved || !saved.sessionId || saved.status === 'IDLE') return;

      const now = Date.now();
      // If was running, calculate elapsed time based on deadline
      if (saved.status === 'FOCUS_RUNNING') {
        if (now >= saved.stageDeadlineTimestamp) {
          // Stage completed while away
          const stageDuration = saved.stageDurationSeconds;
          const completedStage = saved.stage;
          this.current = {
            ...saved,
            stageRemainingSeconds: 0,
            stageElapsedSeconds: stageDuration,
            accumulatedFocusedSeconds: saved.accumulatedFocusedSeconds + stageDuration,
            stagesCompleted: typeof completedStage === 'number' ? completedStage : saved.stagesCompleted,
            status: 'FOCUS_CHECKPOINT',
            lastPersistedTimestamp: now
          };
          this.notify();
          return;
        } else {
          // Still running within deadline
          const remaining = Math.max(0, Math.round((saved.stageDeadlineTimestamp - now) / 1000));
          const elapsed = saved.stageDurationSeconds - remaining;
          this.current = {
            ...saved,
            stageRemainingSeconds: remaining,
            stageElapsedSeconds: elapsed,
            lastPersistedTimestamp: now
          };
          this.startHeartbeat();
          this.notify();
          return;
        }
      } else if (saved.status === 'BREAK_RUNNING') {
        if (now >= saved.stageDeadlineTimestamp) {
          this.current = {
            ...saved,
            stageRemainingSeconds: 0,
            stageElapsedSeconds: saved.stageDurationSeconds,
            accumulatedBreakSeconds: saved.accumulatedBreakSeconds + saved.stageDurationSeconds,
            status: 'SESSION_COMPLETED',
            lastPersistedTimestamp: now
          };
          this.notify();
          return;
        } else {
          const remaining = Math.max(0, Math.round((saved.stageDeadlineTimestamp - now) / 1000));
          this.current = {
            ...saved,
            stageRemainingSeconds: remaining,
            stageElapsedSeconds: saved.stageDurationSeconds - remaining,
            lastPersistedTimestamp: now
          };
          this.startHeartbeat();
          this.notify();
          return;
        }
      } else {
        // Paused or checkpoint
        this.current = saved;
        this.notify();
      }
    } catch (e) {
      removeStorageItem(STORAGE_KEY);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    const timerFn = typeof window !== 'undefined' ? window.setInterval : setInterval;
    this.intervalId = timerFn(() => {
      this.tick();
    }, 250) as any;
  }

  private stopHeartbeat() {
    if (this.intervalId !== null) {
      const clearFn = typeof window !== 'undefined' ? window.clearInterval : clearInterval;
      clearFn(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    const now = Date.now();

    if (this.current.status === 'FOCUS_RUNNING') {
      const remainingMs = this.current.stageDeadlineTimestamp - now;
      if (remainingMs <= 0) {
        // Stage completed!
        this.stopHeartbeat();
        const stageDuration = this.current.stageDurationSeconds;
        const finishedStage = this.current.stage;
        const newAccumulated = this.current.accumulatedFocusedSeconds + stageDuration;
        const newStagesCompleted = typeof finishedStage === 'number' ? finishedStage : this.current.stagesCompleted;

        playChimeSound();

        if (finishedStage === 3) {
          // Focus Cycle (25 min) Complete! Transition to Checkpoint or Break
          showTimerNotification(
            'Focus Cycle Complete! 🎉',
            `You completed 25 minutes of deep focus on ${this.current.activityTitle}. Time for a well-earned break!`
          );
          this.current = {
            ...this.current,
            stageRemainingSeconds: 0,
            stageElapsedSeconds: stageDuration,
            accumulatedFocusedSeconds: newAccumulated,
            stagesCompleted: 3,
            status: 'FOCUS_CHECKPOINT',
            lastPersistedTimestamp: now
          };
        } else {
          // Stage 1 (5m) or Stage 2 (15m) Checkpoint
          const totalMin = Math.round(newAccumulated / 60);
          showTimerNotification(
            `Checkpoint Reached (${totalMin}m)! ⏱️`,
            `Great work on ${this.current.activityTitle}. Continue +10m or wrap up?`
          );
          this.current = {
            ...this.current,
            stageRemainingSeconds: 0,
            stageElapsedSeconds: stageDuration,
            accumulatedFocusedSeconds: newAccumulated,
            stagesCompleted: newStagesCompleted,
            status: 'FOCUS_CHECKPOINT',
            lastPersistedTimestamp: now
          };
        }
        this.notify();
      } else {
        const remainingSec = Math.ceil(remainingMs / 1000);
        const elapsedSec = this.current.stageDurationSeconds - remainingSec;
        this.current = {
          ...this.current,
          stageRemainingSeconds: remainingSec,
          stageElapsedSeconds: elapsedSec,
          lastPersistedTimestamp: now
        };
        this.notify();
      }
    } else if (this.current.status === 'BREAK_RUNNING') {
      const remainingMs = this.current.stageDeadlineTimestamp - now;
      if (remainingMs <= 0) {
        this.stopHeartbeat();
        playChimeSound();
        showTimerNotification('Break Complete ☕', 'Ready to start another focus cycle?');
        this.current = {
          ...this.current,
          stageRemainingSeconds: 0,
          stageElapsedSeconds: this.current.stageDurationSeconds,
          accumulatedBreakSeconds: this.current.accumulatedBreakSeconds + this.current.stageDurationSeconds,
          status: 'SESSION_COMPLETED',
          lastPersistedTimestamp: now
        };
        this.notify();
      } else {
        const remainingSec = Math.ceil(remainingMs / 1000);
        this.current = {
          ...this.current,
          stageRemainingSeconds: remainingSec,
          stageElapsedSeconds: this.current.stageDurationSeconds - remainingSec,
          lastPersistedTimestamp: now
        };
        this.notify();
      }
    }
  }

  // --- Public Controls ---

  public startSession(
    activityId: string,
    activityTitle: string,
    categoryName: string,
    dateKey: string = getLocalDateKey()
  ) {
    // If already active with another session, safely stop previous
    if (this.current.status !== 'IDLE' && this.current.status !== 'SESSION_COMPLETED') {
      this.finishSession();
    }

    const now = Date.now();
    const stageDuration = STAGE_CONFIG[1]; // 5 minutes starter
    const deadline = now + stageDuration * 1000;

    this.current = {
      sessionId: `sess-${now}-${Math.random().toString(36).substring(2, 7)}`,
      activityId,
      activityTitle,
      categoryName,
      dateKey,
      status: 'FOCUS_RUNNING',
      stage: 1,
      stageDurationSeconds: stageDuration,
      stageRemainingSeconds: stageDuration,
      stageElapsedSeconds: 0,
      stageStartTimestamp: now,
      stageDeadlineTimestamp: deadline,
      accumulatedFocusedSeconds: 0,
      accumulatedBreakSeconds: 0,
      pausedRemainingSeconds: 0,
      lastPersistedTimestamp: now,
      stagesCompleted: 0
    };

    this.startHeartbeat();
    this.notify();
  }

  public pause() {
    if (this.current.status !== 'FOCUS_RUNNING' && this.current.status !== 'BREAK_RUNNING') {
      return;
    }
    this.stopHeartbeat();
    const now = Date.now();
    const isBreak = this.current.status === 'BREAK_RUNNING';

    // Save exact remaining seconds
    const remainingMs = Math.max(0, this.current.stageDeadlineTimestamp - now);
    const remainingSec = Math.ceil(remainingMs / 1000);

    this.current = {
      ...this.current,
      status: isBreak ? 'BREAK_PAUSED' : 'FOCUS_PAUSED',
      stageRemainingSeconds: remainingSec,
      pausedRemainingSeconds: remainingSec,
      lastPersistedTimestamp: now
    };
    this.notify();
  }

  public resume() {
    if (this.current.status !== 'FOCUS_PAUSED' && this.current.status !== 'BREAK_PAUSED') {
      return;
    }
    const now = Date.now();
    const isBreak = this.current.status === 'BREAK_PAUSED';
    const remainingSec = this.current.pausedRemainingSeconds || this.current.stageRemainingSeconds;
    const deadline = now + remainingSec * 1000;

    this.current = {
      ...this.current,
      status: isBreak ? 'BREAK_RUNNING' : 'FOCUS_RUNNING',
      stageDeadlineTimestamp: deadline,
      pausedRemainingSeconds: 0,
      lastPersistedTimestamp: now
    };
    this.startHeartbeat();
    this.notify();
  }

  /**
   * Called at a checkpoint: User clicked "Continue +10 Minutes"
   * Moves from Stage 1 -> Stage 2, or Stage 2 -> Stage 3
   */
  public continueCheckpoint() {
    if (this.current.status !== 'FOCUS_CHECKPOINT') return;

    const nextStage: FocusTimerStage = this.current.stage === 1 ? 2 : 3;
    const duration = STAGE_CONFIG[nextStage];
    const now = Date.now();
    const deadline = now + duration * 1000;

    this.current = {
      ...this.current,
      status: 'FOCUS_RUNNING',
      stage: nextStage,
      stageDurationSeconds: duration,
      stageRemainingSeconds: duration,
      stageElapsedSeconds: 0,
      stageStartTimestamp: now,
      stageDeadlineTimestamp: deadline,
      lastPersistedTimestamp: now
    };

    this.startHeartbeat();
    this.notify();
  }

  /**
   * Called when entering the 5-minute break stage after Stage 3 (or manually)
   */
  public startBreak() {
    this.stopHeartbeat();
    const duration = STAGE_CONFIG.break;
    const now = Date.now();
    const deadline = now + duration * 1000;

    this.current = {
      ...this.current,
      status: 'BREAK_RUNNING',
      stage: 'break',
      stageDurationSeconds: duration,
      stageRemainingSeconds: duration,
      stageElapsedSeconds: 0,
      stageStartTimestamp: now,
      stageDeadlineTimestamp: deadline,
      lastPersistedTimestamp: now
    };

    this.startHeartbeat();
    this.notify();
  }

  public skipBreak() {
    this.stopHeartbeat();
    this.current = {
      ...this.current,
      status: 'SESSION_COMPLETED',
      stageRemainingSeconds: 0,
      lastPersistedTimestamp: Date.now()
    };
    this.notify();
  }

  public startAnotherCycle() {
    if (!this.current.activityId) return;
    this.startSession(
      this.current.activityId,
      this.current.activityTitle,
      this.current.categoryName,
      this.current.dateKey
    );
  }

  /**
   * Saves the session to the database with actual elapsed focus time.
   * Does NOT count break time or paused time towards productive minutes.
   */
  public async finishSession(): Promise<number> {
    this.stopHeartbeat();
    const now = Date.now();

    // Calculate actual elapsed focused time
    let totalFocusedSeconds = this.current.accumulatedFocusedSeconds;
    if (this.current.status === 'FOCUS_RUNNING' || this.current.status === 'FOCUS_PAUSED') {
      totalFocusedSeconds += this.current.stageElapsedSeconds;
    }

    const activityId = this.current.activityId;
    const dateKey = this.current.dateKey || getLocalDateKey();
    const stagesCompleted = this.current.stagesCompleted;
    const breakSeconds = this.current.accumulatedBreakSeconds;

    // Persist to database if in browser/environment with indexedDB and at least 15 seconds worked
    if (typeof indexedDB !== 'undefined' && activityId && totalFocusedSeconds >= 15) {
      try {
        const updatedVault = await dbRecordFocusSession({
          activityId,
          dateKey,
          startTimestamp: this.current.stageStartTimestamp || now,
          endTimestamp: now,
          focusedSeconds: totalFocusedSeconds,
          breakSeconds,
          stagesCompleted,
          source: 'timer'
        });
        this.notifySessionSaved(updatedVault);
      } catch (err) {
        console.warn('Failed to record focus session:', err);
      }
    }

    // Reset to IDLE
    this.current = this.getInitialSnapshot();
    this.notify();

    return totalFocusedSeconds;
  }

  public extendSession(additionalMinutes: number = 10) {
    if (!this.current.activityId) return;
    const additionalSec = additionalMinutes * 60;
    this.current.stageDurationSeconds += additionalSec;
    this.current.stageRemainingSeconds += additionalSec;
    this.current.status = 'FOCUS_RUNNING';
    this.startHeartbeat();
    this.notify();
  }

  public cancelSession() {
    this.stopHeartbeat();
    this.current = this.getInitialSnapshot();
    this.notify();
  }
}

// Global Singleton Timer Engine
export const focusTimerEngine = new FocusTimerEngine();
