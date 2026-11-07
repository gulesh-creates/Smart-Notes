import {
  ConsistencyVault,
  ConsistencyCategory,
  ConsistencyActivity,
  ConsistencyDailyRecord,
  ConsistencyFocusSession,
  ConsistencyDailyOverride,
  ConsistencyReflection,
  ConsistencyCalendarEvent,
  ConsistencyVaultSettings,
  ConsistencyRecurrence
} from '@smartnotes/shared';
import { dbGetSetting, dbSetSetting } from './db';

const CONSISTENCY_VAULT_KEY = 'consistency_vault';

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Suggested starter configuration for first-time users (Part 4.3).
 * Total daily commitment: 75 minutes.
 */
export const DEFAULT_CONSISTENCY_VAULT: ConsistencyVault = {
  categories: [
    {
      id: 'cat-academics',
      name: 'Academics',
      description: 'Core university & technical studies',
      orderIndex: 0,
      color: '#38BDF8', // Cyan
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'cat-content',
      name: 'Content Creation',
      description: 'Educational content & tech media',
      orderIndex: 1,
      color: '#A855F7', // Purple
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'cat-agency',
      name: 'Agency Work',
      description: 'LeoVantage Web Studio projects & outreach',
      orderIndex: 2,
      color: '#22C55E', // Green
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    }
  ],
  activities: [
    {
      id: 'act-cpp',
      categoryId: 'cat-academics',
      title: 'C++ Programming',
      description: 'Algorithms, data structures & system programming',
      minMinutes: 20,
      recurrence: { type: 'daily' },
      orderIndex: 0,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-math',
      categoryId: 'cat-academics',
      title: 'Mathematics',
      description: 'Linear algebra, calculus & problem sets',
      minMinutes: 20,
      recurrence: { type: 'daily' },
      orderIndex: 1,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-env-chem',
      categoryId: 'cat-academics',
      title: 'Environmental Chemistry',
      description: 'Readings, diagrams & revision notes',
      minMinutes: 5,
      recurrence: { type: 'daily' },
      orderIndex: 2,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-iks',
      categoryId: 'cat-academics',
      title: 'IKS',
      description: 'Indian Knowledge Systems review',
      minMinutes: 5,
      recurrence: { type: 'daily' },
      orderIndex: 3,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-pcs',
      categoryId: 'cat-academics',
      title: 'PCS',
      description: 'Professional communication & soft skills',
      minMinutes: 5,
      recurrence: { type: 'daily' },
      orderIndex: 4,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-content-creation',
      categoryId: 'cat-content',
      title: 'Content planning / creation',
      description: 'Scripting, recording, and design ideas',
      minMinutes: 10,
      recurrence: { type: 'daily' },
      orderIndex: 0,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    },
    {
      id: 'act-leovantage',
      categoryId: 'cat-agency',
      title: 'LeoVantage Web Studio',
      description: 'Client work, landing pages & studio operations',
      minMinutes: 10,
      recurrence: { type: 'daily' },
      orderIndex: 0,
      isPaused: false,
      isArchived: false,
      createdAt: 1730000000000,
      updatedAt: 1730000000000
    }
  ],
  dailyRecords: [],
  focusSessions: [],
  overrides: [],
  reflections: [],
  calendarEvents: [],
  settings: {
    qualifyingThreshold: 40,
    timerSound: 'bell'
  },
  updatedAt: 1730000000000
};

// Vault Persistence
export async function dbGetConsistencyVault(): Promise<ConsistencyVault> {
  const saved = await dbGetSetting<ConsistencyVault | null>(CONSISTENCY_VAULT_KEY, null);
  if (!saved || !saved.categories || saved.categories.length === 0) {
    // Seed starter configuration for first-time user
    await dbSetSetting(CONSISTENCY_VAULT_KEY, DEFAULT_CONSISTENCY_VAULT);
    return DEFAULT_CONSISTENCY_VAULT;
  }
  return {
    categories: saved.categories || [],
    activities: saved.activities || [],
    dailyRecords: saved.dailyRecords || [],
    focusSessions: saved.focusSessions || [],
    overrides: saved.overrides || [],
    reflections: saved.reflections || [],
    calendarEvents: saved.calendarEvents || [],
    settings: saved.settings || { qualifyingThreshold: 40, timerSound: 'bell' },
    updatedAt: saved.updatedAt || Date.now()
  };
}

export async function dbSaveConsistencyVault(vault: ConsistencyVault): Promise<ConsistencyVault> {
  const updatedVault: ConsistencyVault = {
    ...vault,
    updatedAt: Date.now()
  };
  await dbSetSetting(CONSISTENCY_VAULT_KEY, updatedVault);
  return updatedVault;
}

// Recurrence Rules
export function isActivityScheduledForDate(
  activity: ConsistencyActivity,
  date: Date | string
): boolean {
  if (activity.isPaused || activity.isArchived) return false;

  const targetDate = typeof date === 'string' ? parseLocalDateKey(date) : date;
  const targetDateKey = typeof date === 'string' ? date : getLocalDateKey(date);

  if (activity.startDate && targetDateKey < activity.startDate) return false;
  if (activity.endDate && targetDateKey > activity.endDate) return false;

  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const { type, daysOfWeek } = activity.recurrence;

  switch (type) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      return Array.isArray(daysOfWeek) && daysOfWeek.includes(dayOfWeek);
    default:
      return true;
  }
}

// Scheduled Activity Representation
export interface ScheduledActivityView {
  activity: ConsistencyActivity;
  category: ConsistencyCategory;
  effectiveMinMinutes: number;
  actualMinutes: number;
  isCompleted: boolean;
  completedAt?: number;
  record?: ConsistencyDailyRecord;
  isMinimumDayOverride: boolean;
}

export function getScheduledActivitiesForDate(
  vault: ConsistencyVault,
  dateKey: string
): ScheduledActivityView[] {
  const categoryMap = new Map<string, ConsistencyCategory>();
  for (const cat of vault.categories) {
    if (!cat.isArchived) {
      categoryMap.set(cat.id, cat);
    }
  }

  // Check if there is an active Minimum Day mode override for this date
  const minDayGlobalOverride = vault.overrides.find(
    o => o.dateKey === dateKey && o.isMinimumDay
  );

  const results: ScheduledActivityView[] = [];

  for (const act of vault.activities) {
    if (act.isArchived) continue;
    const cat = categoryMap.get(act.categoryId);
    if (!cat || cat.isPaused) continue;

    if (isActivityScheduledForDate(act, dateKey)) {
      // Find specific record
      const record = vault.dailyRecords.find(
        r => r.activityId === act.id && r.dateKey === dateKey
      );

      // Check specific activity override
      const actOverride = vault.overrides.find(
        o => o.dateKey === dateKey && o.activityId === act.id && typeof o.overrideMinMinutes === 'number'
      );

      let effectiveMinMinutes = act.minMinutes;
      let isMinimumDayOverride = false;

      if (actOverride && typeof actOverride.overrideMinMinutes === 'number') {
        effectiveMinMinutes = actOverride.overrideMinMinutes;
        isMinimumDayOverride = true;
      } else if (minDayGlobalOverride) {
        // In Minimum Day mode, cap required minimum to 5 minutes (or user-defined override)
        effectiveMinMinutes = Math.min(act.minMinutes, 5);
        isMinimumDayOverride = true;
      }

      results.push({
        activity: act,
        category: cat,
        effectiveMinMinutes,
        actualMinutes: record ? record.actualMinutes : 0,
        isCompleted: record ? record.isCompleted : false,
        completedAt: record?.completedAt,
        record,
        isMinimumDayOverride
      });
    }
  }

  // Sort by category orderIndex then activity orderIndex
  return results.sort((a, b) => {
    if (a.category.orderIndex !== b.category.orderIndex) {
      return a.category.orderIndex - b.category.orderIndex;
    }
    return a.activity.orderIndex - b.activity.orderIndex;
  });
}

// Daily Metrics & Scoring
export interface DailyConsistencyMetrics {
  dateKey: string;
  scheduledCount: number;
  completedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  creditedMinutes: number;
  extraMinutes: number;
  timeTargetAchievement: number; // 0.0 - 1.0 (capped at 1.0)
  taskCompletionRate: number;    // 0.0 - 1.0
  consistencyScore: number;      // 0 - 100
  isQualifyingDay: boolean;      // consistencyScore >= 70%
  isRestDay: boolean;            // scheduledCount === 0
  isMinimumDay: boolean;
}

export function calculateDailyMetrics(
  vault: ConsistencyVault,
  dateKey: string,
  qualifyingThreshold = vault?.settings?.qualifyingThreshold ?? 40
): DailyConsistencyMetrics {
  const scheduled = getScheduledActivitiesForDate(vault, dateKey);
  const minDayGlobal = vault.overrides.some(o => o.dateKey === dateKey && o.isMinimumDay);

  if (scheduled.length === 0) {
    return {
      dateKey,
      scheduledCount: 0,
      completedCount: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      creditedMinutes: 0,
      extraMinutes: 0,
      timeTargetAchievement: 1,
      taskCompletionRate: 1,
      consistencyScore: 100,
      isQualifyingDay: true,
      isRestDay: true,
      isMinimumDay: minDayGlobal
    };
  }

  let plannedMinutes = 0;
  let actualMinutes = 0;
  let creditedMinutes = 0;
  let completedCount = 0;

  for (const item of scheduled) {
    plannedMinutes += item.effectiveMinMinutes;
    actualMinutes += item.actualMinutes;
    // Credited time cannot exceed the activity's required minimum
    creditedMinutes += Math.min(item.actualMinutes, item.effectiveMinMinutes);
    if (item.isCompleted) {
      completedCount += 1;
    }
  }

  const extraMinutes = Math.max(0, actualMinutes - creditedMinutes);
  const timeTargetAchievement = plannedMinutes > 0
    ? Math.min(1.0, creditedMinutes / plannedMinutes)
    : 1.0;
  const taskCompletionRate = completedCount / scheduled.length;

  // 50% Time target achievement + 50% Task completion
  const rawScore = (timeTargetAchievement * 0.5 + taskCompletionRate * 0.5) * 100;
  const consistencyScore = Math.round(rawScore);

  // Encourages consistency and realistic effort:
  // A day qualifies if score >= threshold (default 40%), OR user met/exceeded total planned minutes,
  // OR spent >= 60 focused minutes, OR completed >= 3 priorities, OR minimum day engaged.
  const meetsScoreThreshold = consistencyScore >= qualifyingThreshold;
  const metTimeTarget = plannedMinutes > 0 && actualMinutes >= plannedMinutes;
  const highEngagementMinutes = actualMinutes >= 60;
  const finishedSignificantTasks = completedCount >= 3;
  const minimumDayEngaged = minDayGlobal && (completedCount >= 1 || actualMinutes >= 15);

  const isQualifyingDay =
    meetsScoreThreshold ||
    metTimeTarget ||
    highEngagementMinutes ||
    finishedSignificantTasks ||
    minimumDayEngaged;

  return {
    dateKey,
    scheduledCount: scheduled.length,
    completedCount,
    plannedMinutes,
    actualMinutes,
    creditedMinutes,
    extraMinutes,
    timeTargetAchievement,
    taskCompletionRate,
    consistencyScore,
    isQualifyingDay,
    isRestDay: false,
    isMinimumDay: minDayGlobal
  };
}

// Streak Calculation
export interface StreakMetrics {
  currentStreak: number;
  longestStreak: number;
  qualifyingDatesThisWeek: number;
  qualifyingDatesThisMonth: number;
  history: Record<string, DailyConsistencyMetrics>;
}

export function calculateStreak(
  vault: ConsistencyVault,
  referenceDateKey: string = getLocalDateKey()
): StreakMetrics {
  const refDate = parseLocalDateKey(referenceDateKey);
  const history: Record<string, DailyConsistencyMetrics> = {};

  const getMetrics = (dk: string): DailyConsistencyMetrics => {
    if (!history[dk]) {
      history[dk] = calculateDailyMetrics(vault, dk);
    }
    return history[dk];
  };

  // Calculate current streak backward from yesterday, plus today if today already qualifies
  let currentStreak = 0;
  const todayMetrics = getMetrics(referenceDateKey);
  if (todayMetrics && !todayMetrics.isRestDay && todayMetrics.isQualifyingDay) {
    currentStreak += 1;
  }

  // Walk backward starting from yesterday
  let checkDate = new Date(refDate);
  checkDate.setDate(checkDate.getDate() - 1);

  while (true) {
    const dk = getLocalDateKey(checkDate);
    const m = getMetrics(dk);

    if (m.isRestDay) {
      // Intentional rest day does not break streak, but also doesn't artificially inflate it
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (m.isQualifyingDay) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }

    // Safety limit
    if (currentStreak > 365) break;
  }

  // Calculate longest streak in history using dates that actually exist in vault
  const datesSet = new Set<string>();
  (vault.dailyRecords || []).forEach(r => datesSet.add(r.dateKey));
  (vault.focusSessions || []).forEach(s => datesSet.add(s.dateKey));
  datesSet.add(referenceDateKey);

  let longestStreak = currentStreak;
  let tempStreak = 0;
  const sortedDateKeys = Array.from(datesSet).sort(); // chronological

  for (const dk of sortedDateKeys) {
    const m = getMetrics(dk);
    if (m.isRestDay) continue;
    if (m.isQualifyingDay) {
      tempStreak += 1;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Count qualifying days this week (Monday to Sunday)
  const dayOfWeek = refDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(refDate);
  monday.setDate(monday.getDate() - diffToMonday);

  let qualifyingDatesThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    const dk = getLocalDateKey(day);
    const m = getMetrics(dk);
    if (!m.isRestDay && m.isQualifyingDay) {
      qualifyingDatesThisWeek += 1;
    }
  }

  // Count qualifying days this month
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let qualifyingDatesThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dk = getLocalDateKey(dateObj);
    const m = getMetrics(dk);
    if (!m.isRestDay && m.isQualifyingDay) {
      qualifyingDatesThisMonth += 1;
    }
  }

  return {
    currentStreak,
    longestStreak,
    qualifyingDatesThisWeek,
    qualifyingDatesThisMonth,
    history
  };
}

// Activity & Category Mutations
export async function dbAddCategory(
  cat: Omit<ConsistencyCategory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const newCat: ConsistencyCategory = {
    ...cat,
    id: `cat-${now}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now
  };
  const updatedVault = {
    ...vault,
    categories: [...vault.categories, newCat],
    updatedAt: now
  };
  return dbSaveConsistencyVault(updatedVault);
}

export async function dbUpdateCategory(
  id: string,
  updates: Partial<ConsistencyCategory>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const categories = vault.categories.map(c =>
    c.id === id ? { ...c, ...updates, updatedAt: now } : c
  );
  return dbSaveConsistencyVault({ ...vault, categories, updatedAt: now });
}

export async function dbDeleteCategory(id: string): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  // Safe delete: mark category archived and pause nested activities without deleting historical records
  const categories = vault.categories.map(c =>
    c.id === id ? { ...c, isArchived: true, updatedAt: now } : c
  );
  const activities = vault.activities.map(a =>
    a.categoryId === id ? { ...a, isArchived: true, updatedAt: now } : a
  );
  return dbSaveConsistencyVault({ ...vault, categories, activities, updatedAt: now });
}

export async function dbAddActivity(
  act: Omit<ConsistencyActivity, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const newAct: ConsistencyActivity = {
    ...act,
    id: `act-${now}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now
  };
  const updatedVault = {
    ...vault,
    activities: [...vault.activities, newAct],
    updatedAt: now
  };
  return dbSaveConsistencyVault(updatedVault);
}

export async function dbUpdateActivity(
  id: string,
  updates: Partial<ConsistencyActivity>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const activities = vault.activities.map(a =>
    a.id === id ? { ...a, ...updates, updatedAt: now } : a
  );
  return dbSaveConsistencyVault({ ...vault, activities, updatedAt: now });
}

export async function dbDeleteActivity(id: string): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  // Safe delete: mark archived to preserve historical records
  const activities = vault.activities.map(a =>
    a.id === id ? { ...a, isArchived: true, updatedAt: now } : a
  );
  return dbSaveConsistencyVault({ ...vault, activities, updatedAt: now });
}

// Daily Record & Focus Logging Mutations
export async function dbToggleActivityCompletion(
  activityId: string,
  dateKey: string,
  forceCompleted?: boolean
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const recId = `${activityId}_${dateKey}`;
  const existing = vault.dailyRecords.find(r => r.id === recId);

  let newRecords: ConsistencyDailyRecord[];
  if (existing) {
    const isCompleted = forceCompleted !== undefined ? forceCompleted : !existing.isCompleted;
    const updatedRec: ConsistencyDailyRecord = {
      ...existing,
      isCompleted,
      completedAt: isCompleted ? now : undefined,
      updatedAt: now
    };
    newRecords = vault.dailyRecords.map(r => r.id === recId ? updatedRec : r);
  } else {
    const isCompleted = forceCompleted !== undefined ? forceCompleted : true;
    const newRec: ConsistencyDailyRecord = {
      id: recId,
      activityId,
      dateKey,
      isCompleted,
      completedAt: isCompleted ? now : undefined,
      actualMinutes: 0,
      updatedAt: now
    };
    newRecords = [...vault.dailyRecords, newRec];
  }

  return dbSaveConsistencyVault({ ...vault, dailyRecords: newRecords, updatedAt: now });
}

export async function dbRecordFocusSession(
  sessionData: Omit<ConsistencyFocusSession, 'id' | 'createdAt'>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const sessionId = `foc-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const newSession: ConsistencyFocusSession = {
    ...sessionData,
    id: sessionId,
    createdAt: now
  };

  // Convert focused seconds to minutes (rounded to 1 decimal place or integer)
  const additionalMinutes = Math.round((sessionData.focusedSeconds / 60) * 10) / 10;
  const recId = `${sessionData.activityId}_${sessionData.dateKey}`;
  const existingRecord = vault.dailyRecords.find(r => r.id === recId);

  let newRecords: ConsistencyDailyRecord[];
  if (existingRecord) {
    const updatedRec: ConsistencyDailyRecord = {
      ...existingRecord,
      actualMinutes: Math.round((existingRecord.actualMinutes + additionalMinutes) * 10) / 10,
      updatedAt: now
    };
    newRecords = vault.dailyRecords.map(r => r.id === recId ? updatedRec : r);
  } else {
    const newRec: ConsistencyDailyRecord = {
      id: recId,
      activityId: sessionData.activityId,
      dateKey: sessionData.dateKey,
      isCompleted: false, // Independent task completion state
      actualMinutes: additionalMinutes,
      updatedAt: now
    };
    newRecords = [...vault.dailyRecords, newRec];
  }

  const updatedVault: ConsistencyVault = {
    ...vault,
    focusSessions: [...vault.focusSessions, newSession],
    dailyRecords: newRecords,
    updatedAt: now
  };

  return dbSaveConsistencyVault(updatedVault);
}

// Manual Time Entry (Part 9: Distinguishable from timer-measured time)
export async function dbRecordManualTime(
  activityId: string,
  dateKey: string,
  minutes: number,
  notes?: string
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const sessionId = `man-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const newSession: ConsistencyFocusSession = {
    id: sessionId,
    activityId,
    dateKey,
    startTimestamp: now - minutes * 60000,
    endTimestamp: now,
    focusedSeconds: minutes * 60,
    breakSeconds: 0,
    stagesCompleted: 0,
    source: 'manual',
    notes,
    createdAt: now
  };

  const recId = `${activityId}_${dateKey}`;
  const existingRecord = vault.dailyRecords.find(r => r.id === recId);

  let newRecords: ConsistencyDailyRecord[];
  if (existingRecord) {
    const updatedRec: ConsistencyDailyRecord = {
      ...existingRecord,
      actualMinutes: Math.round((existingRecord.actualMinutes + minutes) * 10) / 10,
      updatedAt: now
    };
    newRecords = vault.dailyRecords.map(r => r.id === recId ? updatedRec : r);
  } else {
    const newRec: ConsistencyDailyRecord = {
      id: recId,
      activityId,
      dateKey,
      isCompleted: false,
      actualMinutes: minutes,
      updatedAt: now
    };
    newRecords = [...vault.dailyRecords, newRec];
  }

  const updatedVault: ConsistencyVault = {
    ...vault,
    focusSessions: [...vault.focusSessions, newSession],
    dailyRecords: newRecords,
    updatedAt: now
  };

  return dbSaveConsistencyVault(updatedVault);
}

// Minimum Day Override
export async function dbSetMinimumDayMode(
  dateKey: string,
  isMinimumDay: boolean,
  reason?: string
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const overrideId = `min_day_${dateKey}`;
  const filtered = vault.overrides.filter(o => o.id !== overrideId);

  let overrides: ConsistencyDailyOverride[];
  if (isMinimumDay) {
    overrides = [
      ...filtered,
      {
        id: overrideId,
        dateKey,
        isMinimumDay: true,
        reason: reason || 'Minimum Day adjustment for busy schedule',
        createdAt: now
      }
    ];
  } else {
    overrides = filtered;
  }

  return dbSaveConsistencyVault({ ...vault, overrides, updatedAt: now });
}

// Weekly Reflection
export async function dbSaveWeeklyReflection(
  reflection: ConsistencyReflection
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const filtered = vault.reflections.filter(r => r.weekKey !== reflection.weekKey);
  const updatedReflections = [...filtered, { ...reflection, updatedAt: now }];
  return dbSaveConsistencyVault({ ...vault, reflections: updatedReflections, updatedAt: now });
}

// Calendar Events Helpers
export async function dbSaveCalendarEvent(
  eventData: Omit<ConsistencyCalendarEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const eventId = eventData.id || `cev-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const currentEvents = vault.calendarEvents || [];
  const existing = currentEvents.find(e => e.id === eventId);

  let newEvents: ConsistencyCalendarEvent[];
  if (existing) {
    const updated: ConsistencyCalendarEvent = {
      ...existing,
      ...eventData,
      id: eventId,
      updatedAt: now
    };
    newEvents = currentEvents.map(e => (e.id === eventId ? updated : e));
  } else {
    const created: ConsistencyCalendarEvent = {
      ...eventData,
      id: eventId,
      createdAt: now,
      updatedAt: now
    };
    newEvents = [...currentEvents, created];
  }

  return dbSaveConsistencyVault({
    ...vault,
    calendarEvents: newEvents,
    updatedAt: now
  });
}

export async function dbDeleteCalendarEvent(eventId: string): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const currentEvents = vault.calendarEvents || [];
  const filtered = currentEvents.filter(e => e.id !== eventId);
  return dbSaveConsistencyVault({
    ...vault,
    calendarEvents: filtered,
    updatedAt: now
  });
}

export async function dbGetCalendarEvents(dateKey?: string): Promise<ConsistencyCalendarEvent[]> {
  const vault = await dbGetConsistencyVault();
  const events = vault.calendarEvents || [];
  if (dateKey) {
    return events.filter(e => e.dateKey === dateKey);
  }
  return events;
}

// Settings Helper
export async function dbSaveConsistencySettings(
  settings: Partial<ConsistencyVaultSettings>
): Promise<ConsistencyVault> {
  const vault = await dbGetConsistencyVault();
  const now = Date.now();
  const updatedSettings: ConsistencyVaultSettings = {
    ...(vault.settings || { qualifyingThreshold: 40, timerSound: 'bell' }),
    ...settings
  };
  return dbSaveConsistencyVault({
    ...vault,
    settings: updatedSettings,
    updatedAt: now
  });
}

// Multi-Device Vault Reconciliation Engine
export function reconcileConsistencyVaults(
  local: ConsistencyVault,
  remote: ConsistencyVault
): ConsistencyVault {
  // 1. Categories (keyed by id, latest updatedAt wins)
  const catMap = new Map<string, ConsistencyCategory>();
  for (const c of [...(local.categories || []), ...(remote.categories || [])]) {
    const existing = catMap.get(c.id);
    if (!existing || (c.updatedAt || 0) >= (existing.updatedAt || 0)) {
      catMap.set(c.id, c);
    }
  }

  // 2. Activities (keyed by id, latest updatedAt wins)
  const actMap = new Map<string, ConsistencyActivity>();
  for (const a of [...(local.activities || []), ...(remote.activities || [])]) {
    const existing = actMap.get(a.id);
    if (!existing || (a.updatedAt || 0) >= (existing.updatedAt || 0)) {
      actMap.set(a.id, a);
    }
  }

  // 3. Daily Records (keyed by id, merge completion status and max minutes or latest updatedAt)
  const recMap = new Map<string, ConsistencyDailyRecord>();
  for (const r of [...(local.dailyRecords || []), ...(remote.dailyRecords || [])]) {
    const existing = recMap.get(r.id);
    if (!existing) {
      recMap.set(r.id, r);
    } else {
      const merged: ConsistencyDailyRecord = {
        id: r.id,
        activityId: r.activityId,
        dateKey: r.dateKey,
        isCompleted: existing.isCompleted || r.isCompleted,
        completedAt: existing.completedAt || r.completedAt,
        actualMinutes: Math.max(existing.actualMinutes || 0, r.actualMinutes || 0),
        notes: (r.updatedAt >= existing.updatedAt ? r.notes : existing.notes) || existing.notes || r.notes,
        updatedAt: Math.max(existing.updatedAt || 0, r.updatedAt || 0)
      };
      recMap.set(r.id, merged);
    }
  }

  // 4. Focus Sessions (union all sessions by id so no work is ever lost)
  const sessionMap = new Map<string, ConsistencyFocusSession>();
  for (const s of [...(local.focusSessions || []), ...(remote.focusSessions || [])]) {
    if (!sessionMap.has(s.id)) {
      sessionMap.set(s.id, s);
    }
  }

  // 5. Overrides
  const overrideMap = new Map<string, ConsistencyDailyOverride>();
  for (const o of [...(local.overrides || []), ...(remote.overrides || [])]) {
    const existing = overrideMap.get(o.id);
    if (!existing || (o.createdAt || 0) >= (existing.createdAt || 0)) {
      overrideMap.set(o.id, o);
    }
  }

  // 6. Reflections
  const refMap = new Map<string, ConsistencyReflection>();
  for (const ref of [...(local.reflections || []), ...(remote.reflections || [])]) {
    const existing = refMap.get(ref.id);
    if (!existing || (ref.updatedAt || 0) >= (existing.updatedAt || 0)) {
      refMap.set(ref.id, ref);
    }
  }

  // 7. Calendar Events
  const eventMap = new Map<string, ConsistencyCalendarEvent>();
  for (const ev of [...(local.calendarEvents || []), ...(remote.calendarEvents || [])]) {
    const existing = eventMap.get(ev.id);
    if (!existing || (ev.updatedAt || 0) >= (existing.updatedAt || 0)) {
      eventMap.set(ev.id, ev);
    }
  }

  return {
    categories: Array.from(catMap.values()),
    activities: Array.from(actMap.values()),
    dailyRecords: Array.from(recMap.values()),
    focusSessions: Array.from(sessionMap.values()),
    overrides: Array.from(overrideMap.values()),
    reflections: Array.from(refMap.values()),
    calendarEvents: Array.from(eventMap.values()),
    settings: {
      qualifyingThreshold: local.settings?.qualifyingThreshold ?? remote.settings?.qualifyingThreshold ?? 40,
      timerSound: local.settings?.timerSound ?? remote.settings?.timerSound ?? 'bell'
    },
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
  };
}

