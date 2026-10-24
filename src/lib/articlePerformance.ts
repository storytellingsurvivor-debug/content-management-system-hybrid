import type { BlogRow } from "../types/blog";
import {
  isBotView,
  type BlogViewRow,
  type BrowserRow,
} from "./blogAnalytics";

// Global article performance — one row per article, ranked, plus a per-category
// roll-up. Same read model as blogAnalytics.ts (blog_views + browsers, nothing
// written); robots and bots are excluded so the numbers match the card counts.
//
// The point is to answer, at a glance: what works, what is fading, and what has
// been online for a long time without anyone reading it.

const DAY_MS = 24 * 60 * 60 * 1000;

// Too young to judge: an article needs some time online before "no reads"
// means anything.
export const NEW_ARTICLE_DAYS = 14;
// No human read for this long (or never) → dormant.
export const DORMANT_AFTER_DAYS = 60;

export type ArticleHealth =
  "new" | "top" | "rising" | "steady" | "fading" | "dormant";

export const HEALTH_ORDER: ArticleHealth[] = [
  "top",
  "rising",
  "steady",
  "new",
  "fading",
  "dormant",
];

export interface ArticlePerformance {
  id: string;
  title: string;
  category: string;
  language: string;
  isLive: boolean | null; // null when the row has no is_live / is_active flag
  publishedAt: string | null;
  ageDays: number | null;
  reads: number; // human reads, all time (within the fetched window)
  readsLast7Days: number;
  readsLast30Days: number;
  readsPrev30Days: number; // 30–60 days ago, for the trend
  lastReadAt: string | null;
  daysSinceLastRead: number | null; // null = never read
  readsPerWeek: number; // reads normalised by time online
  trendPercent: number | null; // last 30d vs previous 30d; null = no baseline
  health: ArticleHealth;
}

export interface CategoryPerformance {
  category: string;
  articles: number;
  liveArticles: number;
  reads: number;
  readsLast30Days: number;
  readsPerArticle: number;
  readsPerWeek: number; // sum of article velocities
  dormant: number;
  best: { id: string; title: string; reads: number } | null;
}

function pickString(row: BlogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function liveFlag(row: BlogRow): boolean | null {
  for (const key of ["is_live", "is_active"]) {
    const value = row[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Upper-quartile threshold of the given values (0 when empty).
function upperQuartile(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.75)] ?? 0;
}

export function computeArticlePerformance(
  articles: BlogRow[],
  viewRows: BlogViewRow[],
  browsersBySignature: Map<string, BrowserRow>,
  now: number = Date.now(),
): ArticlePerformance[] {
  // Bucket human view rows by article id once.
  const rowsById = new Map<string, BlogViewRow[]>();
  for (const row of viewRows) {
    if (isBotView(row, browsersBySignature)) continue;
    const id = row.blog_id == null ? "" : String(row.blog_id).trim();
    if (!id) continue;
    const bucket = rowsById.get(id);
    if (bucket) bucket.push(row);
    else rowsById.set(id, [row]);
  }

  const base = articles.flatMap((article) => {
    const id = String(article.id ?? "").trim();
    if (!id) return [];

    const publishedAt =
      pickString(article, "published_at", "publish_date", "created_at") || null;
    const publishedMs = parseTime(publishedAt);
    const ageDays =
      publishedMs == null
        ? null
        : Math.max(0, Math.floor((now - publishedMs) / DAY_MS));

    let readsLast7Days = 0;
    let readsLast30Days = 0;
    let readsPrev30Days = 0;
    let lastReadMs: number | null = null;
    let lastReadAt: string | null = null;
    const rows = rowsById.get(id) ?? [];
    for (const row of rows) {
      const t = parseTime(row.created_at);
      if (t == null) continue;
      const age = now - t;
      if (age <= 7 * DAY_MS) readsLast7Days += 1;
      if (age <= 30 * DAY_MS) readsLast30Days += 1;
      else if (age <= 60 * DAY_MS) readsPrev30Days += 1;
      if (lastReadMs == null || t > lastReadMs) {
        lastReadMs = t;
        lastReadAt = row.created_at ?? null;
      }
    }

    const reads = rows.length;
    // At least one week online, so a two-day-old article with 3 reads is not
    // ranked as a 10-reads-a-week star.
    const weeksOnline = Math.max((ageDays ?? 0) / 7, 1);
    const trendPercent =
      readsPrev30Days > 0
        ? Math.round(
            ((readsLast30Days - readsPrev30Days) / readsPrev30Days) * 100,
          )
        : null;

    return [
      {
        id,
        title: pickString(article, "title", "slug") || `Article #${id}`,
        category: pickString(article, "category") || "Uncategorized",
        language: pickString(article, "language", "lang", "locale"),
        isLive: liveFlag(article),
        publishedAt,
        ageDays,
        reads,
        readsLast7Days,
        readsLast30Days,
        readsPrev30Days,
        lastReadAt,
        daysSinceLastRead:
          lastReadMs == null
            ? null
            : Math.max(0, Math.floor((now - lastReadMs) / DAY_MS)),
        readsPerWeek: round1(reads / weeksOnline),
        trendPercent,
        health: "steady" as ArticleHealth,
      },
    ];
  });

  // "Top" = upper quartile of velocity among articles old enough to judge.
  const topThreshold = upperQuartile(
    base
      .filter((a) => (a.ageDays ?? Infinity) >= NEW_ARTICLE_DAYS)
      .map((a) => a.readsPerWeek),
  );

  for (const a of base) a.health = classify(a, topThreshold);

  // Default ranking: velocity first (fair to old and recent articles alike),
  // then total reads.
  return base.sort(
    (a, b) => b.readsPerWeek - a.readsPerWeek || b.reads - a.reads,
  );
}

function classify(a: ArticlePerformance, topThreshold: number): ArticleHealth {
  if (a.ageDays != null && a.ageDays < NEW_ARTICLE_DAYS) return "new";
  if (
    a.daysSinceLastRead == null ||
    a.daysSinceLastRead >= DORMANT_AFTER_DAYS
  ) {
    return "dormant";
  }
  if (
    topThreshold > 0 &&
    a.readsPerWeek >= topThreshold &&
    a.readsLast30Days > 0
  ) {
    return "top";
  }
  if (a.readsLast30Days >= 3 && a.readsLast30Days >= a.readsPrev30Days * 1.5) {
    return "rising";
  }
  if (a.readsPrev30Days >= 3 && a.readsLast30Days <= a.readsPrev30Days * 0.5) {
    return "fading";
  }
  return "steady";
}

export function computeCategoryPerformance(
  rows: ArticlePerformance[],
): CategoryPerformance[] {
  const byCategory = new Map<string, CategoryPerformance>();
  for (const a of rows) {
    let c = byCategory.get(a.category);
    if (!c) {
      c = {
        category: a.category,
        articles: 0,
        liveArticles: 0,
        reads: 0,
        readsLast30Days: 0,
        readsPerArticle: 0,
        readsPerWeek: 0,
        dormant: 0,
        best: null,
      };
      byCategory.set(a.category, c);
    }
    c.articles += 1;
    if (a.isLive) c.liveArticles += 1;
    c.reads += a.reads;
    c.readsLast30Days += a.readsLast30Days;
    c.readsPerWeek += a.readsPerWeek;
    if (a.health === "dormant") c.dormant += 1;
    if (!c.best || a.reads > c.best.reads) {
      c.best = { id: a.id, title: a.title, reads: a.reads };
    }
  }

  return Array.from(byCategory.values())
    .map((c) => ({
      ...c,
      readsPerArticle: round1(c.reads / c.articles),
      readsPerWeek: round1(c.readsPerWeek),
    }))
    .sort((a, b) => b.readsPerWeek - a.readsPerWeek || b.reads - a.reads);
}

// CSV export of the ranking, for spreadsheets.
export function performanceToCsv(rows: ArticlePerformance[]): string {
  const header = [
    "rank",
    "id",
    "title",
    "category",
    "language",
    "live",
    "published_at",
    "age_days",
    "reads",
    "reads_per_week",
    "reads_7d",
    "reads_30d",
    "reads_prev_30d",
    "trend_percent",
    "last_read_at",
    "days_since_last_read",
    "health",
  ];
  const escape = (value: unknown): string => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((a, i) =>
    [
      i + 1,
      a.id,
      a.title,
      a.category,
      a.language,
      a.isLive == null ? "" : a.isLive,
      a.publishedAt,
      a.ageDays,
      a.reads,
      a.readsPerWeek,
      a.readsLast7Days,
      a.readsLast30Days,
      a.readsPrev30Days,
      a.trendPercent,
      a.lastReadAt,
      a.daysSinceLastRead,
      a.health,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
