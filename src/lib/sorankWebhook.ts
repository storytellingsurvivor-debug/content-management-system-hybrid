// Maps a Sorank "article published" webhook payload onto a `blog` table row.
//
// Sorank (https://www.sorank.com/fr/documentation/webhooks) POSTs a JSON body
// when an article is published: title, slug, full HTML body, meta description,
// image(s) and language are documented, plus "and more". Sorank marks a
// delivery as successful the moment the JSON leaves their side — it cannot see
// whether we read the fields correctly — so the mapping lives here, in one
// place, and reads each value from its documented key with a couple of
// well-known aliases as fallback. See docs/sorank-webhooks.md.

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
