import { parseUserAgent } from "./userAgent";

// Blog analytics read model.
//
// The public sites (Happy/Forever/Support Milo) already record readership with
// two tables — we only READ them here, no new table and no tracker:
//
//   blog_views(id, blog_id, browser_signature, has_viewed, has_liked, created_at)
//     one row per (article, browser) — the site de-duplicates on insert, so a
//     row means "this browser read this article", not "one page hit".
//   browsers(browser_signature, device, user_agent, url_source, created_at)
//     one row per visitor browser; `url_source` is the URL they first landed on.
//
// Browser family and OS are not stored: we derive them from `user_agent` at
// read time (see userAgent.ts).

export const BLOG_VIEWS_TABLE = "blog_views";
export const BROWSERS_TABLE = "browsers";

export interface BlogViewRow {
  id?: number | string;
  blog_id?: number | string | null;
  browser_signature?: string | null;
  has_viewed?: string | boolean | null;
  has_liked?: string | boolean | null;
  created_at?: string | null;
}

export interface BrowserRow {
  browser_signature?: string | null;
  device?: string | null;
  user_agent?: string | null;
  url_source?: string | null;
  created_at?: string | null;
}

export interface DistributionSlice {
  label: string;
  count: number;
  percent: number;
}

export interface DayBucket {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface BlogAnalytics {
  readers: number; // rows = unique (article, browser) pairs
  uniqueVisitors: number; // distinct browser_signature
  likes: number;
  readersLast7Days: number;
  readersLast30Days: number;
  lastViewedAt: string | null;
  browsers: DistributionSlice[];
  devices: DistributionSlice[];
  os: DistributionSlice[];
  sources: DistributionSlice[]; // host of browsers.url_source
  landingUrls: DistributionSlice[]; // raw browsers.url_source
  perDay: DayBucket[];
}

export function isTrue(value: string | boolean | null | undefined): boolean {
  return value === true || String(value ?? "").toLowerCase() === "true";
}

function normLabel(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.length > 0 ? raw : fallback;
}

export function urlHost(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

// Count occurrences of a derived key, then turn the tallies into percentage
// slices sorted from most to least common (capped to `limit` rows).
function distribution<T>(
  rows: T[],
  keyFn: (row: T) => string,
  limit = 8,
): DistributionSlice[] {
  const total = rows.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const slices = Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  if (slices.length <= limit) return slices;

  // Collapse the long tail into a single "Other" slice so bars stay readable.
  const head = slices.slice(0, limit - 1);
  const tail = slices.slice(limit - 1);
  const tailCount = tail.reduce((sum, slice) => sum + slice.count, 0);
  head.push({
    label: `Other (${tail.length})`,
    count: tailCount,
    percent: Math.round((tailCount / total) * 1000) / 10,
  });
  return head;
}

function toDayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// Build a dense daily series (no gaps) for the last `days` days so the bar
// chart renders an even x-axis even when some days had zero readers.
function perDaySeries(rows: BlogViewRow[], days = 30): DayBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = toDayKey(row.created_at);
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

function countSince(rows: BlogViewRow[], sinceMs: number): number {
  return rows.reduce((sum, row) => {
    if (!row.created_at) return sum;
    const t = new Date(row.created_at).getTime();
    return !Number.isNaN(t) && t >= sinceMs ? sum + 1 : sum;
  }, 0);
}

export function computeBlogAnalytics(
  rows: BlogViewRow[],
  browsersBySignature: Map<string, BrowserRow>,
): BlogAnalytics {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Same visitor can appear once per article; count each browser once.
  const signatures = new Set(
    rows
      .map((row) => normLabel(row.browser_signature, ""))
      .filter((value) => value.length > 0),
  );

  // One browser row per view, so distributions stay weighted by readership.
  const visitorRows: BrowserRow[] = rows.map(
    (row) =>
      browsersBySignature.get(normLabel(row.browser_signature, "")) ?? {},
  );

  const lastViewedAt = rows.reduce<string | null>((latest, row) => {
    if (!row.created_at) return latest;
    if (!latest) return row.created_at;
    return new Date(row.created_at) > new Date(latest) ? row.created_at : latest;
  }, null);

  return {
    readers: rows.length,
    uniqueVisitors: signatures.size,
    likes: rows.filter((row) => isTrue(row.has_liked)).length,
    readersLast7Days: countSince(rows, now - 7 * day),
    readersLast30Days: countSince(rows, now - 30 * day),
    lastViewedAt,
    browsers: distribution(
      visitorRows,
      (b) => parseUserAgent(b.user_agent).browser,
    ),
    // `device` is what the site itself recorded; fall back to the parsed UA.
    devices: distribution(visitorRows, (b) =>
      normLabel(b.device, parseUserAgent(b.user_agent).deviceType),
    ),
    os: distribution(visitorRows, (b) => parseUserAgent(b.user_agent).os),
    sources: distribution(visitorRows, (b) =>
      normLabel(urlHost(b.url_source), "Direct / none"),
    ),
    landingUrls: distribution(visitorRows, (b) => normLabel(b.url_source, "—")),
    perDay: perDaySeries(rows),
  };
}

// Group the raw rows by article, so every card can show its own numbers from a
// single pair of queries. Key is `String(blog_id)` to match `String(row.id)`.
export function computeAnalyticsByArticle(
  rows: BlogViewRow[],
  browsersBySignature: Map<string, BrowserRow>,
): Map<string, BlogAnalytics> {
  const grouped = new Map<string, BlogViewRow[]>();
  for (const row of rows) {
    const id = normLabel(row.blog_id == null ? "" : String(row.blog_id), "");
    if (!id) continue;
    const bucket = grouped.get(id);
    if (bucket) bucket.push(row);
    else grouped.set(id, [row]);
  }

  const byArticle = new Map<string, BlogAnalytics>();
  for (const [id, articleRows] of grouped) {
    byArticle.set(id, computeBlogAnalytics(articleRows, browsersBySignature));
  }
  return byArticle;
}

// The single most common label of a distribution, for the compact card view.
export function topLabel(slices: DistributionSlice[]): string | null {
  return slices.length > 0 ? slices[0].label : null;
}
