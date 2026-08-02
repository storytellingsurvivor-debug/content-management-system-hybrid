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

const now = Date.now();
const daysAgo = (n: number) =>
  new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const rows: BlogRow[] = [
  { id: 1, is_public: true, language: "en", created_at: daysAgo(0) },
  { id: 2, is_public: false, language: "fr", created_at: daysAgo(2) },
  { id: 3, is_public: true, language: "en", created_at: daysAgo(10) },
  { id: 4, is_public: true, language: "en", created_at: daysAgo(40) },
  { id: 5, is_public: false, language: null, created_at: daysAgo(400) },
];

const a = computeWallAnalytics({
  rows,
  publicField: "is_public",
  languageField: "language",
  goal: 10,
});

// Counts include EVERY wall, public and private.
assert.equal(a.total, 5, "counts all walls");
assert.equal(a.publicCount, 3);
assert.equal(a.privateCount, 2);

// Time windows.
assert.equal(a.createdLast7Days, 2, "days 0 and 2");
assert.equal(a.createdLast30Days, 3, "days 0, 2, 10");

// Dense daily series covers exactly 30 days and buckets the recent rows.
assert.equal(a.perDay.length, 30, "dense 30-day series");
assert.equal(
  a.perDay.reduce((sum, d) => sum + d.count, 0),
  3,
  "only the last-30-day walls land in the daily series",
);

// Language split, most common first.
assert.equal(a.byLanguage[0].label, "EN");
assert.equal(a.byLanguage[0].count, 3);
assert.equal(a.byLanguage.find((s) => s.label === "FR")?.count, 1);
assert.equal(a.byLanguage.find((s) => s.label === "—")?.count, 1, "null language");

// Visibility split.
assert.equal(a.visibility.find((s) => s.label === "Public")?.count, 3);
assert.equal(a.visibility.find((s) => s.label === "Private")?.count, 2);

// Goal forecast: 5 remaining at 3 walls / 30 days = 0.1/day -> 50 days.
assert.equal(a.goal, 10);
assert.equal(a.remaining, 5);
assert.equal(a.reached, false);
assert.equal(a.goalPercent, 50);
assert.equal(a.projectedDaysToGoal, 50, "ceil(5 / 0.1)");
assert.ok(a.projectedGoalDate, "has a projected date");

// Monthly series spans from the oldest wall (~400 days ago) to now.
assert.ok(a.byMonth.length >= 13, "monthly series spans the full history");

// Reached goal -> no forecast, capped percent.
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

// No public field -> visibility split is empty but totals still work.
const noPublic = computeWallAnalytics({
  rows,
  publicField: null,
  languageField: null,
});
assert.equal(noPublic.total, 5);
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
assert.equal(empty.projectedGoalDate, null);
assert.equal(empty.byMonth.length, 0);

console.log("happy wall analytics: ok");
