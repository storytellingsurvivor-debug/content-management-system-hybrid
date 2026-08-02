import type { BlogRow } from "@/types/blog";
import type { DayBucket, DistributionSlice } from "./blogAnalytics";

// Happy Wall creation analytics — built to keep you moving toward the goal.
//
// This is a READ model over the wall table itself (happy_wall / hope_wall): one
// row = one wall that was created. It counts EVERY wall, public and private,
// because the goal being tracked is "how many Happy Walls have been created".
//
// Beyond the raw tallies it derives the things that actually help you push the
// number up: momentum (are you speeding up or slowing down?), streaks, your
// best days, the pace you need to hit the goal by a deadline, and a short list
// of "where to focus" clues generated from all of the above.
//
// Everything comes from the rows already loaded for the editor — no extra
// tracking table and no tracker. The public flag and language columns are
// discovered at runtime (they differ between schema variants), so the caller
// passes their resolved names in.

export const DEFAULT_WALL_GOAL = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

// created_at is the canonical column, but older DBs used inserted_at; accept both.
const CREATED_AT_NAMES = ["created_at", "inserted_at", "createdAt"];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface WallAnalyticsInput {
  rows: BlogRow[];
  publicField: string | null;
  languageField: string | null;
  goal?: number;
  // Optional deadline (YYYY-MM-DD or ISO) to reach the goal by. When set, the
  // model works out the pace you'd need and whether you're on track for it.
  targetDate?: string | null;
}

// A concrete, prioritised nudge shown under "Where to focus".
export interface FocusInsight {
  tone: "positive" | "warning" | "info";
  icon: string;
  title: string;
  detail: string;
}

export interface WeekdayBucket {
  weekday: string; // Mon..Sun
  count: number;
}

export interface WallAnalytics {
  total: number;
  publicCount: number;
  privateCount: number;
  createdLast7Days: number;
  createdLast30Days: number;
  createdThisMonth: number;
  createdToday: number;
  firstCreatedAt: string | null;
  lastCreatedAt: string | null;
  daysSinceLast: number | null;

  // Pace.
  avgPerDayAllTime: number;
  avgPerDayLast30: number;

  // Momentum: this period vs the one before it.
  createdPrevWeek: number; // days 7-14 ago
  weekMomentumPct: number | null; // % change vs previous week (null if no base)
  createdPrev30Days: number; // days 30-60 ago
  monthMomentumPct: number | null;

  // Streaks & best days (activity = at least one wall created that day).
  currentStreakDays: number;
  longestStreakDays: number;
  activeDaysLast30: number;
  bestDay: DayBucket | null; // busiest single day across all history

  // Patterns.
  byWeekday: WeekdayBucket[]; // Mon..Sun, always 7 entries
  strongestWeekday: WeekdayBucket | null;
  perDay: DayBucket[]; // dense daily series, last 30 days
  byMonth: DayBucket[]; // dense monthly series, first month -> current month
  visibility: DistributionSlice[]; // Public / Private split
  byLanguage: DistributionSlice[];

  // Goal tracking toward `goal` created walls.
  goal: number;
  remaining: number; // walls left to reach the goal (0 once reached)
  goalPercent: number; // total / goal, rounded to 0.1, capped at 100
  reached: boolean;
  nextMilestone: number | null; // next 25/50/75/100% checkpoint above total
  toNextMilestone: number;
  projectedDaysToGoal: number | null; // null when there's no recent pace
  projectedGoalDate: string | null; // ISO date, null when unknown/reached

  // Deadline planning (only when targetDate is supplied).
  targetDate: string | null;
  daysUntilTarget: number | null;
  requiredPerDay: number | null; // remaining / daysUntilTarget
  onTrackForDeadline: boolean | null; // recent pace >= required pace

  // The short, prioritised "where to focus" list.
  insights: FocusInsight[];
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

// Count events whose timestamp is >= sinceMs and (optionally) < untilMs.
function countBetween(
  dates: (string | null)[],
  sinceMs: number,
  untilMs = Infinity,
): number {
  return dates.reduce((sum, value) => {
    if (!value) return sum;
    const t = new Date(value).getTime();
    return !Number.isNaN(t) && t >= sinceMs && t < untilMs ? sum + 1 : sum;
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
function perDaySeries(dayCounts: Map<string, number>, days = 30): DayBucket[] {
  const series: DayBucket[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, count: dayCounts.get(key) ?? 0 });
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
  for (let guard = 0; cursor <= end && guard < 600; guard += 1) {
    const key = cursor.toISOString().slice(0, 7);
    series.push({ day: key, count: counts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return series;
}

// Longest run of consecutive active days anywhere in history.
function longestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = Array.from(activeDays).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    if (cur - prev === DAY_MS) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

// Consecutive active days ending today — with a one-day grace so an untouched
// "today" doesn't wipe a run that's otherwise alive (you might create later).
function currentStreak(activeDays: Set<string>): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const key = (d: Date) => d.toISOString().slice(0, 10);

  const cursor = new Date(today);
  if (!activeDays.has(key(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!activeDays.has(key(cursor))) return 0;
  }
  let streak = 0;
  while (activeDays.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// 25 / 50 / 75 / 100% checkpoints of the goal — the next one above `total`.
function nextMilestoneOf(total: number, goal: number): number | null {
  const checkpoints = [0.25, 0.5, 0.75, 1]
    .map((f) => Math.round(goal * f))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  for (const point of checkpoints) {
    if (point > total) return point;
  }
  return null;
}

function pct(current: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round(((current - base) / base) * 100);
}

// Build the prioritised "where to focus" list from the computed numbers.
function buildInsights(a: Omit<WallAnalytics, "insights">): FocusInsight[] {
  const insights: FocusInsight[] = [];

  if (a.reached) {
    insights.push({
      tone: "positive",
      icon: "🏆",
      title: "Goal smashed!",
      detail: `You've created ${a.total} walls — past your ${a.goal} target. Raise the goal to keep the streak going.`,
    });
    return insights;
  }

  // Deadline pacing takes top billing when a target date is set.
  if (a.requiredPerDay !== null && a.daysUntilTarget !== null) {
    if (a.daysUntilTarget <= 0) {
      insights.push({
        tone: "warning",
        icon: "⏰",
        title: "Deadline has passed",
        detail: `Still ${a.remaining} short of ${a.goal}. Push the target date out and lock in a daily pace you can keep.`,
      });
    } else if (a.onTrackForDeadline) {
      insights.push({
        tone: "positive",
        icon: "🚀",
        title: "On track for your deadline",
        detail: `You need ${a.requiredPerDay.toFixed(1)}/day and you're running ${a.avgPerDayLast30.toFixed(1)}/day. Keep it up.`,
      });
    } else {
      const gap = Math.max(0, a.requiredPerDay - a.avgPerDayLast30);
      insights.push({
        tone: "warning",
        icon: "🎯",
        title: "Pick up the pace to hit the deadline",
        detail: `You need ${a.requiredPerDay.toFixed(1)} walls/day but you're at ${a.avgPerDayLast30.toFixed(1)}/day — about ${gap.toFixed(1)} more each day.`,
      });
    }
  } else if (a.projectedGoalDate) {
    insights.push({
      tone: "info",
      icon: "🧭",
      title: "Your finish line at this pace",
      detail: `Keep creating ${a.avgPerDayLast30.toFixed(1)}/day and you reach ${a.goal} around ${a.projectedGoalDate}. Set a target date to sharpen the plan.`,
    });
  } else {
    insights.push({
      tone: "warning",
      icon: "🌱",
      title: "No recent pace to build on",
      detail: `Nothing created in the last 30 days. Create a few walls to start a trend — even 1/day gets you to ${a.goal}.`,
    });
  }

  // Momentum.
  if (a.weekMomentumPct !== null) {
    if (a.weekMomentumPct > 0) {
      insights.push({
        tone: "positive",
        icon: "📈",
        title: "Momentum is up",
        detail: `${a.createdLast7Days} walls this week vs ${a.createdPrevWeek} last week (+${a.weekMomentumPct}%). Ride the wave.`,
      });
    } else if (a.weekMomentumPct < 0) {
      insights.push({
        tone: "warning",
        icon: "📉",
        title: "Momentum slipped",
        detail: `${a.createdLast7Days} walls this week vs ${a.createdPrevWeek} last week (${a.weekMomentumPct}%). A short push resets the trend.`,
      });
    }
  }

  // Staleness nudge.
  if (a.daysSinceLast !== null && a.daysSinceLast >= 3) {
    insights.push({
      tone: "warning",
      icon: "⏳",
      title: "It's gone quiet",
      detail: `${a.daysSinceLast} days since the last wall. Your current streak resets to 0 if today stays empty.`,
    });
  }

  // Best weekday — a concrete "when to focus" clue.
  if (a.strongestWeekday && a.strongestWeekday.count > 0) {
    insights.push({
      tone: "info",
      icon: "🗓️",
      title: `${a.strongestWeekday.weekday} is your power day`,
      detail: `Most walls land on ${a.strongestWeekday.weekday} (${a.strongestWeekday.count} total). Plan your creation pushes then.`,
    });
  }

  // Language gap — a "what to focus on" clue.
  if (a.byLanguage.length > 1) {
    const weakest = a.byLanguage[a.byLanguage.length - 1];
    const strongest = a.byLanguage[0];
    if (weakest.percent < 20 && weakest.label !== "—") {
      insights.push({
        tone: "info",
        icon: "🌍",
        title: `${weakest.label} is an untapped audience`,
        detail: `Only ${weakest.percent}% of walls are ${weakest.label} vs ${strongest.percent}% ${strongest.label}. Growing it is quick headroom toward ${a.goal}.`,
      });
    }
  }

  return insights.slice(0, 5);
}

export function computeWallAnalytics({
  rows,
  publicField,
  languageField,
  goal = DEFAULT_WALL_GOAL,
  targetDate = null,
}: WallAnalyticsInput): WallAnalytics {
  const now = Date.now();
  const dates = rows.map(createdAtOf);

  const total = rows.length;
  const publicCount = publicField
    ? rows.filter((row) => row[publicField] === true).length
    : 0;
  const privateCount = publicField ? total - publicCount : 0;

  // Day tallies (all history) drive streaks, best day and the 30-day series.
  const dayCounts = new Map<string, number>();
  const weekdayCounts = new Array(7).fill(0);
  let firstCreatedAt: string | null = null;
  let lastCreatedAt: string | null = null;
  for (const value of dates) {
    if (!value) continue;
    const key = toDayKey(value);
    if (key) dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      // JS getUTCDay: 0=Sun..6=Sat -> remap to Mon(0)..Sun(6).
      weekdayCounts[(parsed.getUTCDay() + 6) % 7] += 1;
    }
    if (!firstCreatedAt || new Date(value) < new Date(firstCreatedAt)) {
      firstCreatedAt = value;
    }
    if (!lastCreatedAt || new Date(value) > new Date(lastCreatedAt)) {
      lastCreatedAt = value;
    }
  }

  const activeDays = new Set(dayCounts.keys());
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const createdLast7Days = countBetween(dates, now - 7 * DAY_MS);
  const createdPrevWeek = countBetween(dates, now - 14 * DAY_MS, now - 7 * DAY_MS);
  const createdLast30Days = countBetween(dates, now - 30 * DAY_MS);
  const createdPrev30Days = countBetween(dates, now - 60 * DAY_MS, now - 30 * DAY_MS);
  const avgPerDayLast30 = createdLast30Days / 30;

  const spanDays = firstCreatedAt
    ? Math.max(1, Math.ceil((now - new Date(firstCreatedAt).getTime()) / DAY_MS))
    : 1;
  const avgPerDayAllTime = total / spanDays;

  const daysSinceLast = lastCreatedAt
    ? Math.floor((now - new Date(lastCreatedAt).getTime()) / DAY_MS)
    : null;

  // Busiest single day.
  let bestDay: DayBucket | null = null;
  for (const [day, count] of dayCounts) {
    if (!bestDay || count > bestDay.count) bestDay = { day, count };
  }

  const byWeekday: WeekdayBucket[] = WEEKDAY_LABELS.map((weekday, i) => ({
    weekday,
    count: weekdayCounts[i],
  }));
  const strongestWeekday = byWeekday.reduce<WeekdayBucket | null>(
    (best, cur) => (cur.count > 0 && (!best || cur.count > best.count) ? cur : best),
    null,
  );

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

  // Goal forecast from the recent (30-day) pace.
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

  // Deadline planning.
  let daysUntilTarget: number | null = null;
  let requiredPerDay: number | null = null;
  let onTrackForDeadline: boolean | null = null;
  const targetIso = targetDate ? toDayKey(targetDate) : null;
  if (targetIso && !reached) {
    const targetMs = new Date(`${targetIso}T23:59:59Z`).getTime();
    daysUntilTarget = Math.ceil((targetMs - now) / DAY_MS);
    if (daysUntilTarget > 0) {
      requiredPerDay = remaining / daysUntilTarget;
      onTrackForDeadline = avgPerDayLast30 >= requiredPerDay;
    } else {
      requiredPerDay = remaining; // overdue: it'd take same-day heroics
      onTrackForDeadline = false;
    }
  }

  const base: Omit<WallAnalytics, "insights"> = {
    total,
    publicCount,
    privateCount,
    createdLast7Days,
    createdLast30Days,
    createdThisMonth: countBetween(dates, monthStart.getTime()),
    createdToday: dayCounts.get(todayKey) ?? 0,
    firstCreatedAt,
    lastCreatedAt,
    daysSinceLast,
    avgPerDayAllTime,
    avgPerDayLast30,
    createdPrevWeek,
    weekMomentumPct: pct(createdLast7Days, createdPrevWeek),
    createdPrev30Days,
    monthMomentumPct: pct(createdLast30Days, createdPrev30Days),
    currentStreakDays: currentStreak(activeDays),
    longestStreakDays: longestStreak(activeDays),
    activeDaysLast30: perDaySeries(dayCounts).filter((d) => d.count > 0).length,
    bestDay,
    byWeekday,
    strongestWeekday,
    perDay: perDaySeries(dayCounts),
    byMonth: perMonthSeries(dates),
    visibility: toSlices(visibilityCounts, total),
    byLanguage: toSlices(languageCounts, total),
    goal,
    remaining,
    goalPercent,
    reached,
    nextMilestone: nextMilestoneOf(total, goal),
    toNextMilestone: Math.max(0, (nextMilestoneOf(total, goal) ?? total) - total),
    projectedDaysToGoal,
    projectedGoalDate,
    targetDate: targetIso,
    daysUntilTarget,
    requiredPerDay,
    onTrackForDeadline,
  };

  return { ...base, insights: buildInsights(base) };
}
