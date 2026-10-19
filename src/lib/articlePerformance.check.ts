// Self-check for the global article performance ranking.
//   node --experimental-strip-types src/lib/articlePerformance.check.ts

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Same trick as blogAnalytics.check.ts: resolve extensionless imports.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch {
      return next(`${specifier}.ts`, context);
    }
  },
});

const {
  computeArticlePerformance,
  computeCategoryPerformance,
  performanceToCsv,
} = await import("./articlePerformance.ts");
type BlogViewRow = import("./blogAnalytics.ts").BlogViewRow;
type BrowserRow = import("./blogAnalytics.ts").BrowserRow;

const now = Date.UTC(2026, 9, 19, 12);
const daysAgo = (n: number) =>
  new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const articles = [
  // 1: old and popular, read recently.
  {
    id: 1,
    title: "Star",
    category: "Love",
    is_live: true,
    created_at: daysAgo(70),
  },
  // 2: online for a long time, last read 90 days ago → dormant.
  {
    id: 2,
    title: "Forgotten",
    category: "Love",
    is_live: true,
    created_at: daysAgo(200),
  },
  // 3: never read, old → dormant.
  {
    id: 3,
    title: "Never read",
    category: "Gifts",
    is_live: true,
    created_at: daysAgo(100),
  },
  // 4: brand new, no reads → "new", not dormant.
  {
    id: 4,
    title: "Fresh",
    category: "Gifts",
    is_live: false,
    created_at: daysAgo(3),
  },
  // 5: was read a lot 30–60 days ago, barely now → fading.
  {
    id: 5,
    title: 'Fading, "quoted"',
    category: "Gifts",
    is_live: true,
    created_at: daysAgo(90),
  },
];

const rows: BlogViewRow[] = [];
let sig = 0;
const read = (
  blog_id: number,
  days: number,
  extra: Partial<BlogViewRow> = {},
) =>
  rows.push({
    blog_id,
    browser_signature: `s${sig++}`,
    created_at: daysAgo(days),
    ...extra,
  });

for (let i = 0; i < 20; i += 1) read(1, i % 40);
read(1, 1, { has_liked: "true" });
read(2, 90);
for (let i = 0; i < 6; i += 1) read(5, 40 + i);
read(5, 5);

// A bot reading the never-read article must not wake it up.
rows.push({ blog_id: 3, browser_signature: "bot", created_at: daysAgo(1) });
const browsers = new Map<string, BrowserRow>([
  [
    "bot",
    {
      browser_signature: "bot",
      user_agent:
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    },
  ],
]);

const perf = computeArticlePerformance(articles, rows, browsers, now);
const byId = new Map(perf.map((a) => [a.id, a]));

assert.equal(perf.length, 5);
assert.equal(perf[0].id, "1", "highest velocity ranks first");

const star = byId.get("1")!;
assert.equal(star.reads, 21);
assert.equal(star.likes, 1);
assert.equal(star.ageDays, 70);
assert.equal(star.readsPerWeek, 2.1, "21 reads over 10 weeks");
assert.equal(star.daysSinceLastRead, 0);
assert.equal(star.health, "top");

assert.equal(byId.get("2")!.health, "dormant", "last read 90 days ago");
assert.equal(byId.get("2")!.daysSinceLastRead, 90);

const never = byId.get("3")!;
assert.equal(never.reads, 0, "bot read excluded");
assert.equal(never.daysSinceLastRead, null);
assert.equal(never.health, "dormant");

const fresh = byId.get("4")!;
assert.equal(fresh.health, "new", "too young to be dormant");
assert.equal(fresh.isLive, false);

const fading = byId.get("5")!;
assert.equal(fading.readsLast30Days, 1);
assert.equal(fading.readsPrev30Days, 6);
assert.equal(fading.trendPercent, -83);
assert.equal(fading.health, "fading");

const categories = computeCategoryPerformance(perf);
const love = categories.find((c) => c.category === "Love")!;
const gifts = categories.find((c) => c.category === "Gifts")!;
assert.equal(categories[0].category, "Love", "ranked by velocity");
assert.equal(love.articles, 2);
assert.equal(love.reads, 22);
assert.equal(love.readsPerArticle, 11);
assert.equal(love.dormant, 1);
assert.equal(love.best?.id, "1");
assert.equal(gifts.articles, 3);
assert.equal(gifts.liveArticles, 2);
assert.equal(gifts.dormant, 1);

// Missing category falls back to "Uncategorized".
const uncategorized = computeArticlePerformance(
  [{ id: 9, created_at: daysAgo(30) }],
  [],
  new Map(),
  now,
);
assert.equal(uncategorized[0].category, "Uncategorized");
assert.equal(uncategorized[0].title, "Article #9");

const csv = performanceToCsv(perf).split("\n");
assert.equal(csv.length, 6, "header + one line per article");
assert.ok(
  csv.some((line) => line.includes('"Fading, ""quoted"""')),
  "CSV escaping",
);

console.log("article performance: ok");
