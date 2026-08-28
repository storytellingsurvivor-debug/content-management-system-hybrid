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
  type SorankBrand,
} from "./sorankWebhook.ts";

const brand: SorankBrand = {
  authorName: "Milo",
  authorImageUrl: "https://example.com/author.webp",
  category: "support",
};

// The documented Sorank shape: title, slug, HTML body, meta description,
// language and an images array.
const documented = {
  title: "Comment demander de l'aide",
  slug: "comment-demander-de-l-aide",
  htmlContent: "<h1>Bonjour</h1><p>Texte</p>",
  metaDescription: "Un guide court.",
  language: "fr",
  images: ["https://example.com/cover.webp"],
  keywords: ["aide", "soutien"],
  createdAt: "2026-08-01T10:00:00.000Z",
};

const row = mapSorankArticle(documented, brand, 42);

assert.equal(row.id, 42);
assert.equal(row.title, "Comment demander de l'aide");
assert.equal(row.slug, "comment-demander-de-l-aide");
assert.equal(row.content, "<h1>Bonjour</h1><p>Texte</p>");
assert.equal(row.cover_image_url, "https://example.com/cover.webp");
assert.equal(row.language, "fr");
assert.equal(row.seo_keywords, "aide, soutien");
assert.equal(row.meta_description, "Un guide court.");
assert.equal(row.created_at, "2026-08-01T10:00:00.000Z");
assert.equal(row.author_name, "Milo");
assert.equal(row.author_image_url, "https://example.com/author.webp");
assert.equal(row.category, "support");
assert.equal(row.is_live, false);

// firstString skips empty/blank/non-string candidates.
assert.equal(firstString(undefined, "", "   ", "kept"), "kept");
assert.equal(firstString(null, 5, {}), null);

// Cover image survives the alternate shapes Sorank has shipped.
assert.equal(
  extractCoverImage({ coverImage: "https://example.com/a.png" }),
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
assert.equal(extractCoverImage({}), null);

// Keywords normalise from array or delimited string to one comma-joined string.
assert.equal(extractKeywords({ keywords: ["a", "b"] }), "a, b");
assert.equal(extractKeywords({ tags: "a, b" }), "a, b");
assert.equal(extractKeywords({}), null);

// A payload that only carries HTML under an alias, and no timestamp, still
// yields content plus a generated created_at (never null / "undefined").
const aliased = mapSorankArticle(
  { title: "T", slug: "t", content_html: "<p>x</p>", language: "en" },
  brand,
  1,
);
assert.equal(aliased.content, "<p>x</p>");
assert.equal(typeof aliased.created_at, "string");
assert.ok(!Number.isNaN(Date.parse(aliased.created_at)));
assert.equal(aliased.cover_image_url, null);
assert.equal(aliased.seo_keywords, null);

// --- handleSorankWebhook -------------------------------------------------

// A fake Supabase client: existing rows have a gap (max id 7 while there are
// only 3 rows) so count+1 would collide but max(id)+1 must yield 8.
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

// A well-formed delivery inserts with id = max(id)+1 (8, not count-based).
const okClient = fakeSupabase(7);
const okResponse = await handleSorankWebhook(
  jsonRequest(documented),
  okClient as never,
  brand,
  "test",
);
assert.equal(okResponse.status, 200);
assert.equal(okClient.inserted.length, 1);
assert.equal((okClient.inserted[0] as { id: number }).id, 8);

// First-ever article (empty table) gets id 1.
const emptyClient = fakeSupabase(null);
await handleSorankWebhook(jsonRequest(documented), emptyClient as never, brand, "test");
assert.equal((emptyClient.inserted[0] as { id: number }).id, 1);

// A payload we can't map to slug/content is a 422 that names the keys — not an
// opaque insert 500 — and nothing is inserted.
const badClient = fakeSupabase(7);
const badResponse = await handleSorankWebhook(
  jsonRequest({ heading: "x", markdown: "y" }),
  badClient as never,
  brand,
  "test",
);
assert.equal(badResponse.status, 422);
assert.equal(badClient.inserted.length, 0);
const badBody = (await badResponse.json()) as { receivedKeys: string[] };
assert.deepEqual(badBody.receivedKeys.sort(), ["heading", "markdown"]);

// A non-JSON / empty body is a clean 400, never a thrown 500.
const emptyBody = new Request("https://example.com", {
  method: "POST",
  body: "not json",
});
const emptyResponse = await handleSorankWebhook(
  emptyBody,
  fakeSupabase(7) as never,
  brand,
  "test",
);
assert.equal(emptyResponse.status, 400);

console.log("sorank webhook mapper: ok");
