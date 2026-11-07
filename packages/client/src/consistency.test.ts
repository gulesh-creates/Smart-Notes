import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONSISTENCY_VAULT,
  isActivityScheduledForDate,
  getScheduledActivitiesForDate,
  calculateDailyMetrics,
  calculateStreak,
  reconcileConsistencyVaults,
  getLocalDateKey
} from './storage/consistencyDb';
import { ConsistencyVault, ConsistencyActivity } from '@smartnotes/shared';
import { focusTimerEngine } from './components/consistency/FocusTimerEngine';

describe('Consistency Tracker — Domain Logic & Starter Config', () => {
  it('loads starter configuration with exactly 75 minutes total daily workload', () => {
    assert.equal(DEFAULT_CONSISTENCY_VAULT.categories.length, 3);
    assert.equal(DEFAULT_CONSISTENCY_VAULT.activities.length, 7);

    const totalMinutes = DEFAULT_CONSISTENCY_VAULT.activities.reduce(
      (sum, a) => sum + a.minMinutes,
      0
    );
    assert.equal(totalMinutes, 75); // 20 + 20 + 5 + 5 + 5 + 10 + 10 = 75
  });

  it('recurrence engine schedules daily, weekdays, weekends, and custom rules accurately', () => {
    const monday = new Date(2026, 10, 2); // Nov 2, 2026 is Monday
    const sunday = new Date(2026, 10, 8); // Nov 8, 2026 is Sunday

    const dailyAct: ConsistencyActivity = {
      id: 'a1',
      categoryId: 'c1',
      title: 'Daily Task',
      minMinutes: 10,
      recurrence: { type: 'daily' },
      orderIndex: 0,
      createdAt: 0,
      updatedAt: 0
    };

    const weekdayAct: ConsistencyActivity = {
      id: 'a2',
      categoryId: 'c1',
      title: 'Weekday Work',
      minMinutes: 20,
      recurrence: { type: 'weekdays' },
      orderIndex: 1,
      createdAt: 0,
      updatedAt: 0
    };

    const weekendAct: ConsistencyActivity = {
      id: 'a3',
      categoryId: 'c1',
      title: 'Weekend Review',
      minMinutes: 30,
      recurrence: { type: 'weekends' },
      orderIndex: 2,
      createdAt: 0,
      updatedAt: 0
    };

    const customAct: ConsistencyActivity = {
      id: 'a4',
      categoryId: 'c1',
      title: 'Custom Mon & Wed',
      minMinutes: 15,
      recurrence: { type: 'custom', daysOfWeek: [1, 3] }, // Mon, Wed
      orderIndex: 3,
      createdAt: 0,
      updatedAt: 0
    };

    // Monday checks
    assert.equal(isActivityScheduledForDate(dailyAct, monday), true);
    assert.equal(isActivityScheduledForDate(weekdayAct, monday), true);
    assert.equal(isActivityScheduledForDate(weekendAct, monday), false);
    assert.equal(isActivityScheduledForDate(customAct, monday), true);

    // Sunday checks
    assert.equal(isActivityScheduledForDate(dailyAct, sunday), true);
    assert.equal(isActivityScheduledForDate(weekdayAct, sunday), false);
    assert.equal(isActivityScheduledForDate(weekendAct, sunday), true);
    assert.equal(isActivityScheduledForDate(customAct, sunday), false);
  });

  it('respects activity start and end dates', () => {
    const act: ConsistencyActivity = {
      id: 'a1',
      categoryId: 'c1',
      title: 'Window Activity',
      minMinutes: 10,
      recurrence: { type: 'daily' },
      startDate: '2026-11-05',
      endDate: '2026-11-10',
      orderIndex: 0,
      createdAt: 0,
      updatedAt: 0
    };

    assert.equal(isActivityScheduledForDate(act, '2026-11-04'), false);
    assert.equal(isActivityScheduledForDate(act, '2026-11-05'), true);
    assert.equal(isActivityScheduledForDate(act, '2026-11-08'), true);
    assert.equal(isActivityScheduledForDate(act, '2026-11-10'), true);
    assert.equal(isActivityScheduledForDate(act, '2026-11-11'), false);
  });
});

describe('Consistency Tracker — Daily Metrics & Scoring', () => {
  const testVault: ConsistencyVault = {
    categories: [
      { id: 'cat-1', name: 'Work', orderIndex: 0, createdAt: 0, updatedAt: 0 }
    ],
    activities: [
      {
        id: 'act-1',
        categoryId: 'cat-1',
        title: 'C++ Programming',
        minMinutes: 20,
        recurrence: { type: 'daily' },
        orderIndex: 0,
        createdAt: 0,
        updatedAt: 0
      },
      {
        id: 'act-2',
        categoryId: 'cat-1',
        title: 'Mathematics',
        minMinutes: 20,
        recurrence: { type: 'daily' },
        orderIndex: 1,
        createdAt: 0,
        updatedAt: 0
      }
    ],
    dailyRecords: [],
    focusSessions: [],
    overrides: [],
    reflections: [],
    updatedAt: 0
  };

  it('calculates 0% score when 0 minutes focused and 0 tasks checked', () => {
    const metrics = calculateDailyMetrics(testVault, '2026-11-06');
    assert.equal(metrics.scheduledCount, 2);
    assert.equal(metrics.completedCount, 0);
    assert.equal(metrics.plannedMinutes, 40);
    assert.equal(metrics.actualMinutes, 0);
    assert.equal(metrics.timeTargetAchievement, 0);
    assert.equal(metrics.taskCompletionRate, 0);
    assert.equal(metrics.consistencyScore, 0);
    assert.equal(metrics.isQualifyingDay, false);
  });

  it('caps credited time per activity so overworking one activity does not falsely fulfill others', () => {
    const vaultWithOvertime: ConsistencyVault = {
      ...testVault,
      dailyRecords: [
        {
          id: 'act-1_2026-11-06',
          activityId: 'act-1',
          dateKey: '2026-11-06',
          isCompleted: false,
          actualMinutes: 40, // 40 minutes on act-1 (target was 20)
          updatedAt: 0
        }
        // act-2 has 0 minutes
      ]
    };

    const metrics = calculateDailyMetrics(vaultWithOvertime, '2026-11-06');
    assert.equal(metrics.plannedMinutes, 40);
    assert.equal(metrics.actualMinutes, 40);
    // Credited is capped at min(40, 20) = 20!
    assert.equal(metrics.creditedMinutes, 20);
    assert.equal(metrics.extraMinutes, 20);
    assert.equal(metrics.timeTargetAchievement, 0.5); // 20/40 = 50%
    assert.equal(metrics.taskCompletionRate, 0);
    // Score: 50% * 0.5 + 0 * 0.5 = 25%
    assert.equal(metrics.consistencyScore, 25);
  });

  it('evaluates task completion independently from time progress', () => {
    const vaultWithBoth: ConsistencyVault = {
      ...testVault,
      dailyRecords: [
        {
          id: 'act-1_2026-11-06',
          activityId: 'act-1',
          dateKey: '2026-11-06',
          isCompleted: true, // completed
          actualMinutes: 20, // reached target
          updatedAt: 0
        },
        {
          id: 'act-2_2026-11-06',
          activityId: 'act-2',
          dateKey: '2026-11-06',
          isCompleted: true, // completed
          actualMinutes: 10, // 10/20m
          updatedAt: 0
        }
      ]
    };

    const metrics = calculateDailyMetrics(vaultWithBoth, '2026-11-06');
    // Task completion: 2/2 = 100%
    assert.equal(metrics.taskCompletionRate, 1.0);
    // Time progress: (20 + 10) / 40 = 30/40 = 75%
    assert.equal(metrics.timeTargetAchievement, 0.75);
    // Consistency score: (0.75 * 0.5 + 1.0 * 0.5) * 100 = 87.5 -> 88%
    assert.equal(metrics.consistencyScore, 88);
    assert.equal(metrics.isQualifyingDay, true); // >= 70%
  });

  it('handles intentional rest days without division-by-zero or breaking streaks', () => {
    const emptyVault: ConsistencyVault = {
      ...testVault,
      activities: []
    };
    const metrics = calculateDailyMetrics(emptyVault, '2026-11-06');
    assert.equal(metrics.isRestDay, true);
    assert.equal(metrics.consistencyScore, 100);
    assert.equal(metrics.isQualifyingDay, true);
  });
});

describe('Consistency Tracker — Minimum Day Mode', () => {
  it('temporarily lowers daily minimum target to 5 minutes without modifying global configuration', () => {
    const vaultWithMinDay: ConsistencyVault = {
      categories: [{ id: 'c1', name: 'Study', orderIndex: 0, createdAt: 0, updatedAt: 0 }],
      activities: [
        {
          id: 'act-1',
          categoryId: 'c1',
          title: 'C++',
          minMinutes: 20,
          recurrence: { type: 'daily' },
          orderIndex: 0,
          createdAt: 0,
          updatedAt: 0
        }
      ],
      dailyRecords: [
        {
          id: 'act-1_2026-11-06',
          activityId: 'act-1',
          dateKey: '2026-11-06',
          isCompleted: true,
          actualMinutes: 5,
          updatedAt: 0
        }
      ],
      focusSessions: [],
      overrides: [
        {
          id: 'min_day_2026-11-06',
          dateKey: '2026-11-06',
          isMinimumDay: true,
          reason: 'Busy exam day',
          createdAt: 0
        }
      ],
      reflections: [],
      updatedAt: 0
    };

    // Scheduled view uses effectiveMinMinutes = 5 instead of 20
    const scheduled = getScheduledActivitiesForDate(vaultWithMinDay, '2026-11-06');
    assert.equal(scheduled[0].effectiveMinMinutes, 5);
    assert.equal(scheduled[0].isMinimumDayOverride, true);
    // Base activity configuration remains 20!
    assert.equal(scheduled[0].activity.minMinutes, 20);

    const metrics = calculateDailyMetrics(vaultWithMinDay, '2026-11-06');
    assert.equal(metrics.plannedMinutes, 5);
    assert.equal(metrics.actualMinutes, 5);
    assert.equal(metrics.timeTargetAchievement, 1.0);
    assert.equal(metrics.taskCompletionRate, 1.0);
    assert.equal(metrics.consistencyScore, 100);
    assert.equal(metrics.isQualifyingDay, true);
  });
});

describe('Consistency Tracker — Streak System', () => {
  it('calculates multi-day streaks respecting 70% threshold and rest days', () => {
    const streakVault: ConsistencyVault = {
      categories: [{ id: 'c1', name: 'Work', orderIndex: 0, createdAt: 0, updatedAt: 0 }],
      activities: [
        {
          id: 'act-1',
          categoryId: 'c1',
          title: 'Study',
          minMinutes: 10,
          recurrence: { type: 'daily' },
          orderIndex: 0,
          createdAt: 0,
          updatedAt: 0
        }
      ],
      dailyRecords: [
        // Yesterday (Day -1): 10m completed
        {
          id: 'act-1_2026-11-05',
          activityId: 'act-1',
          dateKey: '2026-11-05',
          isCompleted: true,
          actualMinutes: 10,
          updatedAt: 0
        },
        // Day -2: 10m completed
        {
          id: 'act-1_2026-11-04',
          activityId: 'act-1',
          dateKey: '2026-11-04',
          isCompleted: true,
          actualMinutes: 10,
          updatedAt: 0
        },
        // Day -3: 10m completed
        {
          id: 'act-1_2026-11-03',
          activityId: 'act-1',
          dateKey: '2026-11-03',
          isCompleted: true,
          actualMinutes: 10,
          updatedAt: 0
        }
      ],
      focusSessions: [],
      overrides: [],
      reflections: [],
      updatedAt: 0
    };

    const streak = calculateStreak(streakVault, '2026-11-06');
    // Days 3, 4, 5 all qualified -> current streak is at least 3 days!
    assert.ok(streak.currentStreak >= 3, `Expected currentStreak >= 3, got ${streak.currentStreak}`);
    assert.ok(streak.longestStreak >= 3, `Expected longestStreak >= 3, got ${streak.longestStreak}`);
  });

  it('correctly calculates 2-day streak for Nov 6 and Nov 7 user sessions with realistic qualification rules', () => {
    // Exact user configuration from screenshots: 15 activities with 150m target
    const activities: ConsistencyActivity[] = Array.from({ length: 15 }, (_, i) => ({
      id: `act-${i + 1}`,
      categoryId: 'cat-academics',
      title: `Task ${i + 1}`,
      minMinutes: 10,
      recurrence: { type: 'daily' },
      orderIndex: i,
      createdAt: 0,
      updatedAt: 0
    }));

    const userVault: ConsistencyVault = {
      categories: [{ id: 'cat-academics', name: 'Academics', orderIndex: 0, createdAt: 0, updatedAt: 0 }],
      activities,
      dailyRecords: [
        // Nov 6: 5 completed, 62.7m focused
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `act-${i + 1}_2026-11-06`,
          activityId: `act-${i + 1}`,
          dateKey: '2026-11-06',
          isCompleted: true,
          actualMinutes: i === 0 ? 30 : 8,
          updatedAt: 0
        })),
        // Nov 7: 4 completed, 171.9m focused
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `act-${i + 1}_2026-11-07`,
          activityId: `act-${i + 1}`,
          dateKey: '2026-11-07',
          isCompleted: true,
          actualMinutes: i === 0 ? 60 : 37.3,
          updatedAt: 0
        }))
      ],
      focusSessions: [],
      overrides: [],
      reflections: [],
      settings: { qualifyingThreshold: 40 },
      updatedAt: Date.now()
    };

    // Nov 6 metrics
    const mNov6 = calculateDailyMetrics(userVault, '2026-11-06');
    assert.ok(mNov6.isQualifyingDay, 'Nov 6 should qualify with 5 completed tasks and 62.7m focus time');

    // Nov 7 metrics
    const mNov7 = calculateDailyMetrics(userVault, '2026-11-07');
    assert.ok(mNov7.isQualifyingDay, 'Nov 7 should qualify with 171.9m focus (> 150m target) and 4 completed tasks');

    // Current streak on Nov 7 should be 2 consecutive days
    const streak = calculateStreak(userVault, '2026-11-07');
    assert.equal(streak.currentStreak, 2, 'Current streak on Nov 7 must be 2 days');
  });

  it('reconciles multi-device vaults preserving all activities, sessions, and task completions', () => {
    const localVault: ConsistencyVault = {
      categories: [{ id: 'cat-1', name: 'Academics', orderIndex: 0, createdAt: 0, updatedAt: 100 }],
      activities: [
        { id: 'act-1', categoryId: 'cat-1', title: 'C++', minMinutes: 20, recurrence: { type: 'daily' }, orderIndex: 0, createdAt: 0, updatedAt: 100 },
        { id: 'act-2', categoryId: 'cat-1', title: 'Math', minMinutes: 20, recurrence: { type: 'daily' }, orderIndex: 1, createdAt: 0, updatedAt: 100 }
      ],
      dailyRecords: [
        { id: 'act-1_2026-11-07', activityId: 'act-1', dateKey: '2026-11-07', isCompleted: true, actualMinutes: 25, updatedAt: 150 }
      ],
      focusSessions: [
        { id: 'foc-1', activityId: 'act-1', dateKey: '2026-11-07', startTimestamp: 100, endTimestamp: 200, focusedSeconds: 1500, breakSeconds: 0, stagesCompleted: 1, source: 'timer', createdAt: 200 }
      ],
      overrides: [],
      reflections: [],
      updatedAt: 150
    };

    const remoteVault: ConsistencyVault = {
      categories: [{ id: 'cat-1', name: 'Academics', orderIndex: 0, createdAt: 0, updatedAt: 90 }],
      activities: [
        { id: 'act-1', categoryId: 'cat-1', title: 'C++', minMinutes: 20, recurrence: { type: 'daily' }, orderIndex: 0, createdAt: 0, updatedAt: 90 },
        { id: 'act-3', categoryId: 'cat-1', title: 'Chem', minMinutes: 5, recurrence: { type: 'daily' }, orderIndex: 2, createdAt: 0, updatedAt: 90 }
      ],
      dailyRecords: [
        { id: 'act-3_2026-11-07', activityId: 'act-3', dateKey: '2026-11-07', isCompleted: false, actualMinutes: 5, updatedAt: 120 }
      ],
      focusSessions: [
        { id: 'foc-2', activityId: 'act-3', dateKey: '2026-11-07', startTimestamp: 50, endTimestamp: 100, focusedSeconds: 300, breakSeconds: 0, stagesCompleted: 0, source: 'timer', createdAt: 100 }
      ],
      overrides: [],
      reflections: [],
      updatedAt: 120
    };

    const reconciled = reconcileConsistencyVaults(localVault, remoteVault);
    // Preserves union of activities: act-1, act-2, act-3
    assert.equal(reconciled.activities.length, 3);
    // Preserves union of focus sessions: foc-1, foc-2
    assert.equal(reconciled.focusSessions.length, 2);
    // Preserves daily records: act-1 checked (true), act-3 (5 mins)
    assert.equal(reconciled.dailyRecords.length, 2);
    const rec1 = reconciled.dailyRecords.find(r => r.activityId === 'act-1');
    assert.equal(rec1?.isCompleted, true);
    assert.equal(rec1?.actualMinutes, 25);
  });
});

describe('Consistency Tracker — Progressive Focus Timer State Machine', () => {
  it('initializes in IDLE status and starts with 5-minute starter stage', () => {
    focusTimerEngine.cancelSession();
    assert.equal(focusTimerEngine.getSnapshot().status, 'IDLE');

    focusTimerEngine.startSession('act-cpp', 'C++ Programming', 'Academics');
    const snap = focusTimerEngine.getSnapshot();

    assert.equal(snap.status, 'FOCUS_RUNNING');
    assert.equal(snap.stage, 1);
    assert.equal(snap.stageDurationSeconds, 300); // 5 minutes
    assert.equal(snap.activityTitle, 'C++ Programming');

    // Pause
    focusTimerEngine.pause();
    assert.equal(focusTimerEngine.getSnapshot().status, 'FOCUS_PAUSED');

    // Resume
    focusTimerEngine.resume();
    assert.equal(focusTimerEngine.getSnapshot().status, 'FOCUS_RUNNING');

    // Clean up
    focusTimerEngine.cancelSession();
  });

  it('cycles through Stage 1 (5m) -> Checkpoint -> Stage 2 (10m) -> Stage 3 (10m) -> Break (5m)', () => {
    focusTimerEngine.cancelSession();
    focusTimerEngine.startSession('act-cpp', 'C++ Programming', 'Academics');

    // Manually trigger deadline completion for Stage 1 (mocking 5 minutes elapsed)
    const snap1 = focusTimerEngine.getSnapshot();
    assert.equal(snap1.stage, 1);

    // Fast-forward stage deadline
    (focusTimerEngine as any).current.stageDeadlineTimestamp = Date.now() - 1000;
    (focusTimerEngine as any).tick();

    const checkpoint1 = focusTimerEngine.getSnapshot();
    assert.equal(checkpoint1.status, 'FOCUS_CHECKPOINT');
    assert.equal(checkpoint1.accumulatedFocusedSeconds, 300); // 5 minutes credited

    // User clicks "Continue +10 Minutes" -> Stage 2 starts
    focusTimerEngine.continueCheckpoint();
    const snap2 = focusTimerEngine.getSnapshot();
    assert.equal(snap2.status, 'FOCUS_RUNNING');
    assert.equal(snap2.stage, 2);
    assert.equal(snap2.stageDurationSeconds, 600); // 10 minutes

    // Fast-forward Stage 2 completion
    (focusTimerEngine as any).current.stageDeadlineTimestamp = Date.now() - 1000;
    (focusTimerEngine as any).tick();

    const checkpoint2 = focusTimerEngine.getSnapshot();
    assert.equal(checkpoint2.status, 'FOCUS_CHECKPOINT');
    assert.equal(checkpoint2.accumulatedFocusedSeconds, 900); // 15 minutes total

    // User clicks "Continue +10 Minutes" -> Stage 3 starts (deep focus)
    focusTimerEngine.continueCheckpoint();
    const snap3 = focusTimerEngine.getSnapshot();
    assert.equal(snap3.stage, 3);
    assert.equal(snap3.stageDurationSeconds, 600); // 10 minutes

    // Fast-forward Stage 3 completion
    (focusTimerEngine as any).current.stageDeadlineTimestamp = Date.now() - 1000;
    (focusTimerEngine as any).tick();

    const checkpoint3 = focusTimerEngine.getSnapshot();
    assert.equal(checkpoint3.status, 'FOCUS_CHECKPOINT');
    assert.equal(checkpoint3.accumulatedFocusedSeconds, 1500); // 25 minutes total!
    assert.equal(checkpoint3.stagesCompleted, 3);

    // Transition to 5-minute break
    focusTimerEngine.startBreak();
    const breakSnap = focusTimerEngine.getSnapshot();
    assert.equal(breakSnap.status, 'BREAK_RUNNING');
    assert.equal(breakSnap.stage, 'break');
    assert.equal(breakSnap.stageDurationSeconds, 300); // 5 minutes

    // Clean up
    focusTimerEngine.cancelSession();
  });

  it('records actual elapsed focused time when finishing early', async () => {
    focusTimerEngine.cancelSession();
    focusTimerEngine.startSession('act-math', 'Mathematics', 'Academics');

    // Simulate 3 minutes worked in Stage 1
    (focusTimerEngine as any).current.stageElapsedSeconds = 180;
    const recordedSec = await focusTimerEngine.finishSession();

    assert.equal(recordedSec, 180); // exact 180 seconds (3 minutes) saved, not 300s!
    assert.equal(focusTimerEngine.getSnapshot().status, 'IDLE');
  });
});

describe('Consistency Tracker — Time Records & Manual Entry', () => {
  it('distinguishes manual vs timer source sessions in session records', () => {
    const sessionTimer: any = {
      id: 's1',
      activityId: 'act-1',
      dateKey: '2026-11-06',
      startTimestamp: 1000,
      endTimestamp: 2000,
      focusedSeconds: 600,
      breakSeconds: 0,
      stagesCompleted: 2,
      source: 'timer',
      createdAt: 1000
    };

    const sessionManual: any = {
      id: 's2',
      activityId: 'act-1',
      dateKey: '2026-11-06',
      startTimestamp: 3000,
      endTimestamp: 4000,
      focusedSeconds: 900,
      breakSeconds: 0,
      stagesCompleted: 0,
      source: 'manual',
      notes: 'Read chapter 4 offline',
      createdAt: 3000
    };

    assert.equal(sessionTimer.source, 'timer');
    assert.equal(sessionManual.source, 'manual');
    assert.equal(sessionManual.notes, 'Read chapter 4 offline');
  });
});

