import type { SupabaseClient } from "@supabase/supabase-js";

export const BLOG_VIEW_TABLE = "blog_view";

// One raw view event, as stored by the ingestion route. Every field except the
// slug is optional because trackers in the wild send partial data.
export interface BlogViewRow {
  id?: number | string;
  created_at?: string;
  article_id?: number | string | null;
  article_slug?: string | null;
  language?: string | null;
  landing_url?: string | null;
  referrer?: string | null;
  referrer_host?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  browser?: string | null;
  os?: string | null;
  device_type?: string | null;
  visitor_hash?: string | null;
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

export interface ArticleAnalytics {
  slug: string;
  totalViews: number;
  uniqueVisitors: number;
  viewsLast7Days: number;
  viewsLast30Days: number;
  lastViewedAt: string | null;
  browsers: DistributionSlice[];
  devices: DistributionSlice[];
  os: DistributionSlice[];
  sources: DistributionSlice[]; // utm_source ?? referrer_host ?? "direct"
  referrers: DistributionSlice[];
  landingUrls: DistributionSlice[];
  perDay: DayBucket[];
}

// Probes whether the analytics table exists on the connected DB, so the UI can
// show setup instructions instead of an error when it hasn't been created yet.
export async function blogViewTableExists(
  client: SupabaseClient,
): Promise<boolean> {
  const { error } = await client
    .from(BLOG_VIEW_TABLE)
    .select("id", { count: "exact", head: true })
    .limit(1);
  return !error;
}

function normLabel(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.length > 0 ? raw : fallback;
}

// Count occurrences of a derived key, then turn the tallies into percentage
// slices sorted from most to least common (capped to `limit` rows).
function distribution(
  rows: BlogViewRow[],
  keyFn: (row: BlogViewRow) => string,
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

function sourceLabel(row: BlogViewRow): string {
  const utm = normLabel(row.utm_source, "");
  if (utm) return utm;
  const host = normLabel(row.referrer_host, "");
  if (host) return host;
  const ref = normLabel(row.referrer, "");
  if (ref) {
    try {
      return new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      return ref;
    }
  }
  return "Direct / none";
}

function toDayKey(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// Build a dense daily series (no gaps) for the last `days` days so a bar chart
// renders an even x-axis even when some days had zero views.
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

export function computeArticleAnalytics(
  slug: string,
  rows: BlogViewRow[],
): ArticleAnalytics {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const uniqueVisitors = new Set(
    rows
      .map((row) => normLabel(row.visitor_hash, ""))
      .filter((value) => value.length > 0),
  ).size;

  const lastViewedAt = rows.reduce<string | null>((latest, row) => {
    if (!row.created_at) return latest;
    if (!latest) return row.created_at;
    return new Date(row.created_at) > new Date(latest)
      ? row.created_at
      : latest;
  }, null);

  return {
    slug,
    totalViews: rows.length,
    uniqueVisitors,
    viewsLast7Days: countSince(rows, now - 7 * day),
    viewsLast30Days: countSince(rows, now - 30 * day),
    lastViewedAt,
    browsers: distribution(rows, (r) => normLabel(r.browser, "Unknown")),
    devices: distribution(rows, (r) => normLabel(r.device_type, "unknown")),
    os: distribution(rows, (r) => normLabel(r.os, "Unknown")),
    sources: distribution(rows, sourceLabel),
    referrers: distribution(rows, (r) =>
      normLabel(r.referrer_host, "Direct / none"),
    ),
    landingUrls: distribution(rows, (r) => normLabel(r.landing_url, "—")),
    perDay: perDaySeries(rows),
  };
}
