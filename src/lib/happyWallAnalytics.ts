import type { BlogRow } from "@/types/blog";
import type { DayBucket, DistributionSlice } from "./blogAnalytics";

// Happy Wall creation analytics.
//
// This is a READ model over the wall table itself (happy_wall / hope_wall): one
// row = one wall that was created. Unlike the Visits section it counts EVERY
// wall, public and private alike, because the goal being tracked here is
// "how many Happy Walls have been created", not "how many are live".
//
// Everything is derived from the rows already loaded for the editor — no extra
// tracking table and no tracker. The public flag and language columns are
// discovered at runtime (they differ between schema variants), so the caller
// passes their resolved names in.

export const DEFAULT_WALL_GOAL = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

// created_at is the canonical column, but older DBs used inserted_at; accept both.
const CREATED_AT_NAMES = ["created_at", "inserted_at", "createdAt"];

export interface WallAnalyticsInput {
  rows: BlogRow[];
  publicField: string | null;
  languageField: string | null;
  goal?: number;
}

export interface WallAnalytics {
  total: number;
  publicCount: number;
  privateCount: number;
  createdLast7Days: number;
  createdLast30Days: number;
  createdThisMonth: number;
  firstCreatedAt: string | null;
  lastCreatedAt: string | null;
  // Average walls created per day, over the whole life of the table.
  avgPerDayAllTime: number;
  // Recent pace: walls/day averaged over the last 30 days. Drives the forecast.
  avgPerDayLast30: number;
  perDay: DayBucket[]; // dense daily series, last 30 days
  byMonth: DayBucket[]; // dense monthly series, first month -> current month
  visibility: DistributionSlice[]; // Public / Private split
  byLanguage: DistributionSlice[];
  // Goal tracking toward `goal` created walls.
  goal: number;
  remaining: number; // walls left to reach the goal (0 once reached)
  goalPercent: number; // total / goal, rounded to 0.1, capped at 100
  reached: boolean;
  projectedDaysToGoal: number | null; // null when there's no recent pace
  projectedGoalDate: string | null; // ISO date, null when unknown/reached
}

function createdAtOf(row: BlogRow): string | null {
  for (const name of CREATED_AT_NAMES) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function toDayKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toMonthKey(value: string | null): string | null {
  const day = toDayKey(value);
  return day ? day.slice(0, 7) : null; // YYYY-MM
}

function countSince(dates: (string | null)[], sinceMs: number): number {
  return dates.reduce((sum, value) => {
    if (!value) return sum;
    const t = new Date(value).getTime();
    return !Number.isNaN(t) && t >= sinceMs ? sum + 1 : sum;
  }, 0);
}

// Turn tallies into percentage slices, most common first.
function toSlices(counts: Map<string, number>, total: number): DistributionSlice[] {
  if (total === 0) return [];
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

// Dense daily buckets for the last `days` days (no gaps), ending today (UTC).
function perDaySeries(dates: (string | null)[], days = 30): DayBucket[] {
  const counts = new Map<string, number>();
  for (const value of dates) {
    const key = toDayKey(value);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const series: DayBucket[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return series;
}

// Dense monthly buckets from the first recorded month to the current month.
function perMonthSeries(dates: (string | null)[]): DayBucket[] {
  const counts = new Map<string, number>();
  let earliest: string | null = null;
  for (const value of dates) {
    const key = toMonthKey(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!earliest || key < earliest) earliest = key;
  }
  if (!earliest) return [];

  const series: DayBucket[] = [];
  const [startYear, startMonth] = earliest.split("-").map(Number);
  const now = new Date();
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Guard against a malformed earliest date producing an unbounded loop.
  for (let guard = 0; cursor <= end && guard < 600; guard += 1) {
    const key = cursor.toISOString().slice(0, 7);
    series.push({ day: key, count: counts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return series;
}

export function computeWallAnalytics({
  rows,
  publicField,
  languageField,
  goal = DEFAULT_WALL_GOAL,
}: WallAnalyticsInput): WallAnalytics {
  const now = Date.now();
  const dates = rows.map(createdAtOf);

  const total = rows.length;
  const publicCount = publicField
    ? rows.filter((row) => row[publicField] === true).length
    : 0;
  const privateCount = publicField ? total - publicCount : 0;

  let firstCreatedAt: string | null = null;
  let lastCreatedAt: string | null = null;
  for (const value of dates) {
    if (!value) continue;
    if (!firstCreatedAt || new Date(value) < new Date(firstCreatedAt)) {
      firstCreatedAt = value;
    }
    if (!lastCreatedAt || new Date(value) > new Date(lastCreatedAt)) {
      lastCreatedAt = value;
    }
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const createdLast30Days = countSince(dates, now - 30 * DAY_MS);
  const avgPerDayLast30 = createdLast30Days / 30;

  const spanDays = firstCreatedAt
    ? Math.max(1, Math.ceil((now - new Date(firstCreatedAt).getTime()) / DAY_MS))
    : 1;
  const avgPerDayAllTime = total / spanDays;

  // Language split.
  const languageCounts = new Map<string, number>();
  if (languageField) {
    for (const row of rows) {
      const raw = row[languageField];
      const label =
        typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : "—";
      languageCounts.set(label, (languageCounts.get(label) ?? 0) + 1);
    }
  }

  // Visibility split.
  const visibilityCounts = new Map<string, number>();
  if (publicField) {
    visibilityCounts.set("Public", publicCount);
    visibilityCounts.set("Private", privateCount);
  }

  // Goal forecast: use the recent (30-day) pace, since that's what "on track to
  // hit 500" actually depends on.
  const remaining = Math.max(0, goal - total);
  const reached = total >= goal;
  const goalPercent =
    goal > 0 ? Math.min(100, Math.round((total / goal) * 1000) / 10) : 0;

  let projectedDaysToGoal: number | null = null;
  let projectedGoalDate: string | null = null;
  if (!reached && avgPerDayLast30 > 0) {
    projectedDaysToGoal = Math.ceil(remaining / avgPerDayLast30);
    projectedGoalDate = new Date(now + projectedDaysToGoal * DAY_MS)
      .toISOString()
      .slice(0, 10);
  }

  return {
    total,
    publicCount,
    privateCount,
    createdLast7Days: countSince(dates, now - 7 * DAY_MS),
    createdLast30Days,
    createdThisMonth: countSince(dates, monthStart.getTime()),
    firstCreatedAt,
    lastCreatedAt,
    avgPerDayAllTime,
    avgPerDayLast30,
    perDay: perDaySeries(dates),
    byMonth: perMonthSeries(dates),
    visibility: toSlices(visibilityCounts, total),
    byLanguage: toSlices(languageCounts, total),
    goal,
    remaining,
    goalPercent,
    reached,
    projectedDaysToGoal,
    projectedGoalDate,
  };
}
