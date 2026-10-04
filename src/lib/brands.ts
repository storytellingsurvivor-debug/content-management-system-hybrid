import type { SupabaseClient } from "@supabase/supabase-js";

export type BrandKey = "happy" | "forever" | "support" | "other";

export interface BrandPreset {
  key: BrandKey;
  label: string;
  url: string;
}

export const BRAND_PRESETS: BrandPreset[] = [
  {
    key: "happy",
    label: "Happy Milo",
    url: "https://sffejjhgtqzrdhudminu.supabase.co",
  },
  {
    key: "forever",
    label: "Forever Milo",
    url: "https://hhztnlxperhjpmvbjjhb.supabase.co",
  },
  {
    key: "support",
    label: "Support Milo",
    url: "https://fyzzkcjuwqypafzifhck.supabase.co",
  },
  { key: "other", label: "Autre", url: "" },
];

// Happy-Milo renamed hope_wall_* -> happy_wall_*; older DBs keep the old names.
const TEMPLATE_TABLE_CANDIDATES = [
  "happy_wall_audience_template",
  "hope_wall_audience_template",
];
const WALL_TABLE_CANDIDATES = ["happy_wall", "hope_wall"];

export interface WorkspaceFeatures {
  templateTable: string | null;
  wallTable: string | null;
  hasSpots: boolean;
  hasDates: boolean;
}

async function tableExists(
  client: SupabaseClient,
  table: string,
): Promise<boolean> {
  const { error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .limit(1);
  return !error;
}

async function firstExistingTable(
  client: SupabaseClient,
  candidates: string[],
): Promise<string | null> {
  for (const table of candidates) {
    if (await tableExists(client, table)) return table;
  }
  return null;
}

// Probes each feature table so the UI only shows tabs the connected DB supports.
export async function detectWorkspaceFeatures(
  client: SupabaseClient,
): Promise<WorkspaceFeatures> {
  const [templateTable, wallTable, hasSpots, hasDates] = await Promise.all([
    firstExistingTable(client, TEMPLATE_TABLE_CANDIDATES),
    firstExistingTable(client, WALL_TABLE_CANDIDATES),
    tableExists(client, "happy_spot"),
    tableExists(client, "happy_date"),
  ]);
  return { templateTable, wallTable, hasSpots, hasDates };
}

// Public site per brand, used to build shareable article links. Brands
// without an entry get no "Copy URL" button.
const BRAND_SITE_URLS: Partial<Record<BrandKey, string>> = {
  happy: "https://www.happy-milo.com",
};

export type SiteLanguage = "en" | "fr";

// Maps the article's `language` value to the site's URL segment. Rows hold a
// short code ("fr", "en"), but webhook-ingested rows can carry a BCP-47 tag
// ("fr-FR", "en_US"), so keep the primary subtag like sorankWebhook does.
// Returns null for anything else rather than guessing a wrong link.
export function toSiteLanguage(language: string): SiteLanguage | null {
  const code = language.trim().split(/[-_]/)[0].toLowerCase();
  return code === "en" || code === "fr" ? code : null;
}

export type ArticlePublicUrl =
  | { url: string; error: null }
  | { url: null; error: string };

// Builds `<site>/<en|fr>/blog/<slug>`. Returns null when the brand has no
// public site; otherwise the URL, or why it can't be built yet.
export function buildArticlePublicUrl(
  brand: BrandKey,
  language: string,
  slug: string,
): ArticlePublicUrl | null {
  const site = BRAND_SITE_URLS[brand];
  if (!site) return null;
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSlug) return { url: null, error: "Article has no slug yet" };
  const lang = toSiteLanguage(language);
  if (!lang) {
    return {
      url: null,
      error: language.trim()
        ? `Language "${language.trim()}" is not en or fr`
        : "Article has no language (en or fr)",
    };
  }
  return {
    url: `${site}/${lang}/blog/${encodeURIComponent(cleanSlug)}`,
    error: null,
  };
}
