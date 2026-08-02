// Self-check for the Happy Wall creation analytics.
//   node --experimental-strip-types src/lib/happyWallAnalytics.check.ts
// ponytail: no test framework in this repo, one assert script is enough.

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Next resolves extensionless imports; plain Node ESM does not. Teach it that
// trick so this file can import the real module.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch {
      return next(`${specifier}.ts`, context);
    }
  },
});

const { computeWallAnalytics, DEFAULT_WALL_GOAL } = await import(
  "./happyWallAnalytics.ts"
);
type BlogRow = import("../types/blog.ts").BlogRow;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY).toISOString();

const rows: BlogRow[] = [
  { id: 1, is_public: true, language: "en", created_at: daysAgo(0) },
  { id: 2, is_public: false, language: "fr", created_at: daysAgo(1) },
  { id: 3, is_public: true, language: "en", created_at: daysAgo(2) },
  { id: 4, is_public: true, language: "en", created_at: daysAgo(10) },
  { id: 5, is_public: false, language: null, created_at: daysAgo(40) },
  { id: 6, is_public: true, language: "en", created_at: daysAgo(400) },
];

const a = computeWallAnalytics({
  rows,
  publicField: "is_public",
  languageField: "language",
  goal: 12,
});

// Counts include EVERY wall, public and private.
assert.equal(a.total, 6, "counts all walls");
assert.equal(a.publicCount, 4);
assert.equal(a.privateCount, 2);

// Time windows.
assert.equal(a.createdLast7Days, 3, "days 0,1,2");
assert.equal(a.createdLast30Days, 4, "days 0,1,2,10");
assert.equal(a.createdToday, 1);

// Streak: days 0,1,2 are consecutive and include today -> streak of 3.
assert.equal(a.currentStreakDays, 3, "consecutive days ending today");
assert.ok(a.longestStreakDays >= 3);
assert.equal(a.daysSinceLast, 0, "most recent wall is today");

// Momentum: 3 this week vs previous week (days 7-14 -> only day 10) = 1 -> +200%.
assert.equal(a.createdPrevWeek, 1);
assert.equal(a.weekMomentumPct, 200);

// Best day and weekday pattern are present.
assert.ok(a.bestDay, "has a busiest day");
assert.equal(a.byWeekday.length, 7, "Mon..Sun");
assert.ok(a.strongestWeekday, "has a strongest weekday");

// Language split, most common first; weakest last.
assert.equal(a.byLanguage[0].label, "EN");
assert.equal(a.byLanguage[0].count, 4);
assert.equal(a.byLanguage[a.byLanguage.length - 1].count <= a.byLanguage[0].count, true);

// Visibility split.
assert.equal(a.visibility.find((s) => s.label === "Public")?.count, 4);
assert.equal(a.visibility.find((s) => s.label === "Private")?.count, 2);

// Goal + milestone (goal 12 -> checkpoints 3/6/9/12; total 6 -> next is 9).
assert.equal(a.goal, 12);
assert.equal(a.remaining, 6);
assert.equal(a.reached, false);
assert.equal(a.nextMilestone, 9);
assert.equal(a.toNextMilestone, 3);
assert.ok(a.projectedGoalDate, "has a projected date from recent pace");

// Insights are generated and prioritised (>=1, <=5).
assert.ok(a.insights.length >= 1 && a.insights.length <= 5, "insight count bounded");
assert.ok(a.insights.every((i) => i.title && i.detail && i.icon), "insights are filled");

// Deadline planning: need 6 more in 12 days -> 0.5/day required.
const withDeadline = computeWallAnalytics({
  rows,
  publicField: "is_public",
  languageField: "language",
  goal: 12,
  targetDate: new Date(now + 12 * DAY).toISOString().slice(0, 10),
});
// End-of-day target -> 12 or 13 whole days out depending on current time.
assert.ok(
  withDeadline.daysUntilTarget === 12 || withDeadline.daysUntilTarget === 13,
  "roughly 12 days until target",
);
assert.ok(withDeadline.requiredPerDay !== null);
assert.equal(
  withDeadline.requiredPerDay,
  withDeadline.remaining / (withDeadline.daysUntilTarget ?? 1),
  "required pace = remaining / days left",
);
assert.equal(typeof withDeadline.onTrackForDeadline, "boolean");

// Reached goal -> celebration insight, no forecast, capped percent.
const reached = computeWallAnalytics({
  rows,
  publicField: "is_public",
  languageField: "language",
  goal: 3,
});
assert.equal(reached.reached, true);
assert.equal(reached.remaining, 0);
assert.equal(reached.goalPercent, 100, "percent caps at 100");
assert.equal(reached.projectedGoalDate, null);
assert.equal(reached.insights[0].tone, "positive");

// No public field -> visibility split empty but totals still work.
const noPublic = computeWallAnalytics({
  rows,
  publicField: null,
  languageField: null,
});
assert.equal(noPublic.total, 6);
assert.equal(noPublic.publicCount, 0);
assert.equal(noPublic.visibility.length, 0);
assert.equal(noPublic.goal, DEFAULT_WALL_GOAL);

// Empty table -> zeros, no forecast, no NaN.
const empty = computeWallAnalytics({
  rows: [],
  publicField: "is_public",
  languageField: "language",
});
assert.equal(empty.total, 0);
assert.equal(empty.avgPerDayAllTime, 0);
assert.equal(empty.currentStreakDays, 0);
assert.equal(empty.projectedGoalDate, null);
assert.equal(empty.byMonth.length, 0);
assert.ok(empty.insights.length >= 1, "empty state still coaches");

console.log("happy wall analytics: ok");
