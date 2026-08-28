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

// Sorank documents "images"; different payload versions have shipped a single
// cover string, a `{ url }` object, or an array of either. Pull the first
// usable URL out of whatever shape arrives.
export function extractCoverImage(body: Record<string, unknown>): string | null {
  const direct = firstString(
    body.coverImage,
    body.cover_image,
    body.featuredImage,
    body.featured_image,
    body.heroImageUrl,
    body.image,
    body.imageUrl,
    body.image_url,
  );
  if (direct) return direct;

  const candidates: unknown[] = [];
  if (Array.isArray(body.images)) candidates.push(...body.images);
  else if (body.images !== undefined) candidates.push(body.images);
  if (Array.isArray(body.image)) candidates.push(...body.image);

  for (const candidate of candidates) {
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
  return null;
}

// Keywords come as an array or as a comma/-separated string depending on the
// payload version; the `blog` column stores a single comma-joined string.
export function extractKeywords(body: Record<string, unknown>): string | null {
  const raw = body.keywords ?? body.seoKeywords ?? body.tags;
  if (Array.isArray(raw)) {
    const joined = raw
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  return firstString(raw);
}

export function mapSorankArticle(
  body: Record<string, unknown>,
  brand: SorankBrand,
  nextId: number,
): SorankBlogRow {
  return {
    id: nextId,
    title: firstString(body.title, body.name),
    slug: firstString(body.slug),
    cover_image_url: extractCoverImage(body),
    // Sorank delivers the article as a full HTML body; markdown/plain aliases
    // are tolerated so a payload-format change does not drop the content.
    content: firstString(
      body.htmlContent,
      body.html_content,
      body.contentHtml,
      body.content_html,
      body.html,
      body.body,
      body.content,
      body.content_markdown,
    ),
    language: firstString(
      body.language,
      body.languageCode,
      body.language_code,
      body.locale,
      body.lang,
    ),
    seo_keywords: extractKeywords(body),
    meta_description: firstString(
      body.metaDescription,
      body.meta_description,
      body.description,
    ),
    created_at:
      firstString(
        body.createdAt,
        body.created_at,
        body.publishedAt,
        body.published_at,
        body.date,
      ) ?? new Date().toISOString(),
    author_name: brand.authorName,
    author_image_url: brand.authorImageUrl,
    category: brand.category,
    read_time_in_minutes: 5,
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
    console.error(
      `[${logPrefix}] payload missing ${missing.join(", ")}. Received keys:`,
      Object.keys(payload),
    );
    return Response.json(
      {
        error: `Could not map required field(s): ${missing.join(", ")}.`,
        receivedKeys: Object.keys(payload),
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
