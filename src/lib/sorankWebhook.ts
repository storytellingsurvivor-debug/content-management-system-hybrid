// Maps a Sorank "article published" webhook payload onto a `blog` table row.
//
// Sorank (https://www.sorank.com/fr/documentation/webhooks) POSTs a JSON body
// when an article is published: title, slug, full HTML body, meta description,
// image(s) and language are documented, plus "and more". Sorank marks a
// delivery as successful the moment the JSON leaves their side — it cannot see
// whether we read the fields correctly — so the mapping lives here, in one
// place, and reads each value from its documented key with a couple of
// well-known aliases as fallback. See docs/sorank-webhooks.md.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SorankBrand {
  authorName: string;
  authorImageUrl: string;
  category: string;
}

// The `blog` row shape the webhook routes insert. Mirrors the columns the
// babylovegrowth routes already write.
export interface SorankBlogRow {
  id: number;
  title: unknown;
  slug: unknown;
  cover_image_url: string | null;
  content: unknown;
  language: unknown;
  seo_keywords: string | null;
  meta_description: unknown;
  created_at: string;
  author_name: string;
  author_image_url: string;
  category: string;
  read_time_in_minutes: number;
  is_live: boolean;
}

// First candidate that is a non-empty string, else null. Keeps the field
// lookups forgiving without silently turning `undefined` into "undefined".
export function firstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

// The article payload lives under `article`; older/flat deliveries put the
// fields at the top level, so fall back to the body itself.
export function articleOf(body: Record<string, unknown>): Record<string, unknown> {
  const article = body.article;
  return article && typeof article === "object" && !Array.isArray(article)
    ? (article as Record<string, unknown>)
    : body;
}

// Sorank's `featured_image` / `images[]` entries are `{ url, alt, placement }`
// objects; older/flat payloads used a bare string or a `{ url }`. Pull the
// first usable cover URL out of whatever shape arrives.
export function extractCoverImage(article: Record<string, unknown>): string | null {
  const fromObject = firstString(
    asRecord(article.featured_image).url,
    asRecord(article.featuredImage).url,
    asRecord(article.coverImage).url,
    asRecord(article.image).url,
  );
  if (fromObject) return fromObject;

  const direct = firstString(
    article.featured_image,
    article.featuredImage,
    article.coverImage,
    article.cover_image,
    article.heroImageUrl,
    article.image,
    article.imageUrl,
    article.image_url,
  );
  if (direct) return direct;

  const images = article.images;
  if (Array.isArray(images)) {
    for (const candidate of images) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
      const url = firstString(
        asRecord(candidate).url,
        asRecord(candidate).src,
        asRecord(candidate).imageUrl,
      );
      if (url) return url;
    }
  }
  return null;
}

// Sorank sends a single `focus_keyphrase` (mirrored as `keyword`); older
// payloads used an array/CSV. The `blog` column stores a comma-joined string.
export function extractKeywords(article: Record<string, unknown>): string | null {
  const single = firstString(article.focus_keyphrase, article.keyword);
  if (single) return single;

  const raw = article.keywords ?? article.seoKeywords ?? article.tags;
  if (Array.isArray(raw)) {
    const joined = raw
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  return firstString(raw);
}

// The `blog` rows use a short language code ("fr", "en"); Sorank sends a BCP-47
// tag ("fr-FR", "en-US"). Keep the primary subtag so ingested rows sort/filter
// alongside the existing content.
export function normalizeLanguage(value: string | null): string | null {
  if (!value) return value;
  return value.split(/[-_]/)[0].toLowerCase();
}

// Derive reading time from Sorank's word_count (~200 wpm), min 1; fall back to
// the previous fixed 5 when word_count is absent.
export function readTimeMinutes(wordCount: unknown): number {
  const words = Number(wordCount);
  if (!Number.isFinite(words) || words <= 0) return 5;
  return Math.max(1, Math.round(words / 200));
}

export function mapSorankArticle(
  body: Record<string, unknown>,
  brand: SorankBrand,
  nextId: number,
): SorankBlogRow {
  const article = articleOf(body);
  return {
    id: nextId,
    title: firstString(article.title, article.name),
    slug: firstString(article.slug),
    cover_image_url: extractCoverImage(article),
    // Sorank delivers the article as a full HTML body; markdown/plain aliases
    // are tolerated so a payload-format change does not drop the content.
    content: firstString(
      article.content,
      article.htmlContent,
      article.html_content,
      article.contentHtml,
      article.content_html,
      article.html,
      article.body,
      article.content_markdown,
    ),
    language: normalizeLanguage(
      firstString(
        article.language,
        article.languageCode,
        article.language_code,
        article.locale,
        article.lang,
      ),
    ),
    seo_keywords: extractKeywords(article),
    meta_description: firstString(
      article.meta_description,
      article.metaDescription,
      article.description,
    ),
    // The delivery timestamp is the best "created" signal Sorank gives; an
    // article-level date is used if a future payload adds one.
    created_at:
      firstString(
        article.createdAt,
        article.created_at,
        article.publishedAt,
        article.published_at,
        body.timestamp,
        body.date,
      ) ?? new Date().toISOString(),
    author_name: brand.authorName,
    author_image_url: brand.authorImageUrl,
    category: brand.category,
    read_time_in_minutes: readTimeMinutes(article.word_count),
    is_live: false,
  };
}

// The `blog` columns that cannot be null. If a payload maps any of these to a
// falsy value the DB insert would raise a bare 500 with no clue why — so we
// stop first and report which keys actually arrived.
const REQUIRED_COLUMNS: (keyof SorankBlogRow)[] = ["title", "slug", "content"];

// Shared POST handler for every Sorank route. Differences between routes are
// just the Supabase client, the brand defaults, and a log prefix.
//
// Hardened vs. the babylovegrowth routes on the two ways a first delivery can
// 500 invisibly on Netlify:
//   1. an unparseable / empty test body -> clean 400 instead of a thrown 500;
//   2. a payload whose keys we don't map -> 422 that names the received keys,
//      instead of a NOT NULL violation surfacing as an opaque 500.
// The insert also uses max(id)+1 rather than count+1 so a deleted row (a gap
// between count and the real max id) can't cause a duplicate-key 500.
export async function handleSorankWebhook(
  request: Request,
  supabase: SupabaseClient,
  brand: SorankBrand,
  logPrefix: string,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error(`[${logPrefix}] body was not valid JSON`);
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    console.error(`[${logPrefix}] body was not a JSON object:`, body);
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;

  // Log the full delivery so the exact Sorank field names/shapes are visible in
  // the Netlify function logs — the payload is public article content, and this
  // is the only way to confirm the mapping without reaching Sorank directly.
  console.log(`[${logPrefix}] raw payload:`, JSON.stringify(payload));

  // `webhook.test` is Sorank's connectivity probe — acknowledge it 200 without
  // inserting, so clicking "Test" doesn't litter the blog with dummy rows. Only
  // `article.published` (or a flat payload with no event) is ingested.
  const eventType = firstString(payload.event);
  if (eventType === "webhook.test") {
    console.log(`[${logPrefix}] webhook.test acknowledged (no insert)`);
    return Response.json({ status: "ok", test: true }, { status: 200 });
  }

  const { data: maxRows, error: maxError } = await supabase
    .from("blog")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  if (maxError) {
    console.error(`[${logPrefix}] max-id lookup failed:`, maxError);
    return Response.json({ error: maxError }, { status: 500 });
  }

  const topId = Array.isArray(maxRows)
    ? Number((maxRows[0] as { id?: unknown } | undefined)?.id ?? 0)
    : 0;
  const nextId = (Number.isFinite(topId) ? topId : 0) + 1;

  const row = mapSorankArticle(payload, brand, nextId);

  const missing = REQUIRED_COLUMNS.filter((column) => !row[column]);
  if (missing.length > 0) {
    const receivedKeys = {
      body: Object.keys(payload),
      article: Object.keys(articleOf(payload)),
    };
    console.error(
      `[${logPrefix}] payload missing ${missing.join(", ")}. Received keys:`,
      JSON.stringify(receivedKeys),
    );
    return Response.json(
      {
        error: `Could not map required field(s): ${missing.join(", ")}.`,
        receivedKeys,
        mapped: row,
      },
      { status: 422 },
    );
  }

  const result = await supabase.from("blog").insert(row);

  console.log(
    `[${logPrefix}] insert result:`,
    JSON.stringify(result.error ?? { status: "ok", id: nextId }),
  );

  if (result.error) {
    return Response.json(
      { error: result.error, mapped: row },
      { status: 500 },
    );
  }

  return Response.json({ status: "ok" }, { status: 200 });
}
