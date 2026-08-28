// Self-check for the Sorank webhook payload mapper.
//   node --experimental-strip-types src/lib/sorankWebhook.check.ts
// ponytail: no test framework in this repo, one assert script is enough.

import assert from "node:assert/strict";
import {
  extractCoverImage,
  extractKeywords,
  firstString,
  handleSorankWebhook,
  mapSorankArticle,
  normalizeLanguage,
  readTimeMinutes,
  type SorankBrand,
} from "./sorankWebhook.ts";

const brand: SorankBrand = {
  authorName: "Milo",
  authorImageUrl: "https://example.com/author.webp",
  category: "Actualités",
};

// The real Sorank `article.published` envelope: fields nested under `article`,
// with event / delivery_id / timestamp at the top level.
const published = {
  event: "article.published",
  delivery_id: "11111111-2222-3333-4444-555555555555",
  timestamp: "2026-08-28T21:23:09.000Z",
  article: {
    id: "art_123",
    title: "Comment demander de l'aide",
    slug: "comment-demander-de-l-aide",
    meta_description: "Un guide court et concret.",
    focus_keyphrase: "demander de l'aide",
    content: "<h1>Bonjour</h1><p>Texte</p>",
    featured_image: {
      url: "https://example.com/cover.webp",
      alt: "couverture",
      placement: "top",
    },
    images: [],
    word_count: 800,
    keyword: "demander de l'aide",
    language: "fr-FR",
  },
};

const row = mapSorankArticle(published, brand, 74);

assert.equal(row.id, 74);
assert.equal(row.title, "Comment demander de l'aide");
assert.equal(row.slug, "comment-demander-de-l-aide");
assert.equal(row.content, "<h1>Bonjour</h1><p>Texte</p>");
assert.equal(row.cover_image_url, "https://example.com/cover.webp");
assert.equal(row.language, "fr"); // BCP-47 "fr-FR" -> primary subtag
assert.equal(row.seo_keywords, "demander de l'aide");
assert.equal(row.meta_description, "Un guide court et concret.");
assert.equal(row.created_at, "2026-08-28T21:23:09.000Z"); // top-level timestamp
assert.equal(row.read_time_in_minutes, 4); // 800 words / 200 wpm
assert.equal(row.author_name, "Milo");
assert.equal(row.category, "Actualités");
assert.equal(row.is_live, false);

// Helpers in isolation.
assert.equal(firstString(undefined, "", "   ", "kept"), "kept");
assert.equal(firstString(null, 5, {}), null);
assert.equal(normalizeLanguage("en-US"), "en");
assert.equal(normalizeLanguage("FR"), "fr");
assert.equal(normalizeLanguage(null), null);
assert.equal(readTimeMinutes(800), 4);
assert.equal(readTimeMinutes(50), 1); // rounds up to a 1-minute floor
assert.equal(readTimeMinutes(undefined), 5); // fallback when absent

// featured_image object, images[] objects, and legacy flat strings all resolve.
assert.equal(
  extractCoverImage({ featured_image: { url: "https://example.com/a.png" } }),
  "https://example.com/a.png",
);
assert.equal(
  extractCoverImage({ images: [{ url: "https://example.com/b.png" }] }),
  "https://example.com/b.png",
);
assert.equal(
  extractCoverImage({ featuredImage: "https://example.com/c.png" }),
  "https://example.com/c.png",
);
assert.equal(extractCoverImage({ images: [] }), null);

// Keywords: single focus_keyphrase, keyword fallback, then array/CSV.
assert.equal(extractKeywords({ focus_keyphrase: "a" }), "a");
assert.equal(extractKeywords({ keyword: "b" }), "b");
assert.equal(extractKeywords({ keywords: ["a", "b"] }), "a, b");
assert.equal(extractKeywords({}), null);

// A legacy flat payload (fields at top level, no `article`) still maps.
const flat = mapSorankArticle(
  { title: "T", slug: "t", content: "<p>x</p>", language: "en" },
  brand,
  1,
);
assert.equal(flat.title, "T");
assert.equal(flat.content, "<p>x</p>");
assert.equal(flat.language, "en");
assert.equal(typeof flat.created_at, "string");

// --- handleSorankWebhook -------------------------------------------------

function fakeSupabase(topId: number | null) {
  const inserted: unknown[] = [];
  const client = {
    inserted,
    from() {
      return {
        select() {
          return {
            order() {
              return {
                limit() {
                  return Promise.resolve({
                    data: topId === null ? [] : [{ id: topId }],
                    error: null,
                  });
                },
              };
            },
          };
        },
        insert(row: unknown) {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return client;
}

function jsonRequest(payload: unknown): Request {
  return new Request("https://example.com/api/webhooks/sorank/happy/prod", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// article.published inserts with id = max(id)+1 (73 existing max -> 74).
const okClient = fakeSupabase(73);
const okResponse = await handleSorankWebhook(
  jsonRequest(published),
  okClient as never,
  brand,
  "test",
);
assert.equal(okResponse.status, 200);
assert.equal(okClient.inserted.length, 1);
assert.equal((okClient.inserted[0] as { id: number }).id, 74);

// webhook.test is acknowledged 200 but never inserts a row.
const testClient = fakeSupabase(73);
const testResponse = await handleSorankWebhook(
  jsonRequest({ event: "webhook.test", delivery_id: "x", timestamp: "t" }),
  testClient as never,
  brand,
  "test",
);
assert.equal(testResponse.status, 200);
assert.equal(testClient.inserted.length, 0);

// First-ever article on an empty table gets id 1.
const emptyClient = fakeSupabase(null);
await handleSorankWebhook(jsonRequest(published), emptyClient as never, brand, "test");
assert.equal((emptyClient.inserted[0] as { id: number }).id, 1);

// An unmappable article is a 422 naming the article keys — not an insert 500.
const badClient = fakeSupabase(73);
const badResponse = await handleSorankWebhook(
  jsonRequest({ event: "article.published", article: { heading: "x", markdown: "y" } }),
  badClient as never,
  brand,
  "test",
);
assert.equal(badResponse.status, 422);
assert.equal(badClient.inserted.length, 0);
const badBody = (await badResponse.json()) as {
  receivedKeys: { article: string[] };
};
assert.deepEqual(badBody.receivedKeys.article.sort(), ["heading", "markdown"]);

// A non-JSON body is a clean 400, never a thrown 500.
const emptyResponse = await handleSorankWebhook(
  new Request("https://example.com", { method: "POST", body: "not json" }),
  fakeSupabase(73) as never,
  brand,
  "test",
);
assert.equal(emptyResponse.status, 400);

console.log("sorank webhook mapper: ok");
