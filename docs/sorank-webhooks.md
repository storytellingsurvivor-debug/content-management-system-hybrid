# Sorank webhooks (article ingestion)

[Sorank](https://www.sorank.com/fr/documentation/webhooks) is an SEO article
generator. Its **Webhook** connector POSTs a JSON body to a URL of your choice
every time an article is published — the same idea as the existing
`babylovegrowth` webhooks, just a different sender. These endpoints receive that
POST and insert one row into the Supabase `blog` table.

> Sorank marks a delivery **successful the moment the JSON leaves its side**. That
> status only means the data reached the endpoint and got a `2xx` back — Sorank
> cannot see whether the fields were mapped or the article went live. Everything
> that happens after "received" is on us, which is why the mapping is unit-checked
> (`src/lib/sorankWebhook.check.ts`).

## Endpoints

Four routes, mirroring the `babylovegrowth` layout — one axis is the Supabase
project (prod / staging), the other is the brand defaults written onto the row.

| Route | Supabase env | Author image | Category |
| ----- | ------------ | ------------ | -------- |
| `POST /api/webhooks/sorank/prod` | `*_PROD` | blog author avatar | `support` |
| `POST /api/webhooks/sorank/staging` | `*_STAGING` | blog author avatar | `support` |
| `POST /api/webhooks/sorank/happy/prod` | `*_PROD` | Happy Milo avatar | `Actualités` |
| `POST /api/webhooks/sorank/happy/staging` | `*_STAGING` | Happy Milo avatar | `Actualités` |

Each reads `SUPABASE_URL_{PROD,STAGING}` and
`SUPABASE_SERVICE_ROLE_KEY_{PROD,STAGING}`. Point the corresponding Sorank
project's webhook URL at the matching route.

## Request / response

- **Method:** `POST`, `Content-Type: application/json`.
- **Success:** `200 { "status": "ok" }`.
- **`400 { "error": ... }`** — the body was not a JSON object (empty / wrong
  content-type). Guards Sorank's "Test" button when it sends no article.
- **`422 { "error", "receivedKeys", "mapped" }`** — the payload parsed but
  nothing mapped onto the required `slug` / `content` columns. `receivedKeys`
  lists the keys Sorank actually sent, so the mapper can be pointed at them.
  This turns an otherwise opaque NOT NULL `500` into a self-describing response.
- **`500 { "error", "mapped" }`** — the Supabase insert itself failed. `mapped`
  is the row we tried to insert. Also logged with a `[sorank/...]` prefix.

All four routes share one handler, `handleSorankWebhook` in
`src/lib/sorankWebhook.ts`. New-row `id` is `max(id) + 1` (not `count + 1`, which
collides once any row has been deleted and a gap opens between the count and the
real max id).

Sorank does not send a signing secret documented as required, so the routes do
not verify one today. The path itself is the shared secret (as with the
`babylovegrowth` routes); keep the URL private.

## Field mapping

Sorank documents that the payload carries the article's **title, slug, full HTML
body, meta description, image(s) and language** ("and more"). The exact key
names are not contractually pinned and have varied between payload versions, so
`src/lib/sorankWebhook.ts` reads each value from its documented key with a few
well-known aliases as fallback rather than trusting one spelling.

| `blog` column | Read from (first match wins) |
| ------------- | ---------------------------- |
| `title` | `title`, `name` |
| `slug` | `slug` |
| `content` | `htmlContent`, `contentHtml`, `content_html`, `html`, `body`, `content`, `content_markdown` |
| `cover_image_url` | `coverImage`, `featuredImage`, `heroImageUrl`, `image`, `imageUrl`, or the first URL in `images[]` (string or `{ url }`) |
| `language` | `language`, `languageCode`, `locale`, `lang` |
| `seo_keywords` | `keywords` / `seoKeywords` / `tags` — array joined with `, ` or a string as-is |
| `meta_description` | `metaDescription`, `description` |
| `created_at` | `createdAt`, `publishedAt`, `date` — falls back to `now()` if absent |

Fixed per route (not from the payload): `author_name`, `author_image_url`,
`category` (the brand defaults above), `read_time_in_minutes: 5`, and
`is_live: false` — new articles land unpublished for review. `id` is set to
`count(blog) + 1`, matching the `babylovegrowth` routes.

### Example payload

```json
{
  "title": "Comment demander de l'aide",
  "slug": "comment-demander-de-l-aide",
  "htmlContent": "<h1>Bonjour</h1><p>…</p>",
  "metaDescription": "Un guide court et concret.",
  "language": "fr",
  "images": ["https://cdn.example.com/cover.webp"],
  "keywords": ["aide", "soutien"],
  "createdAt": "2026-08-01T10:00:00.000Z"
}
```

## Assumptions & follow-ups

The exact Sorank key names above are taken from the public documentation plus the
tolerant aliasing; confirm them against a real delivery and prune the mapper to
the keys Sorank actually sends. Same open items as `babylovegrowth`:
`read_time_in_minutes` is a fixed `5` (could be derived from body length), and
`is_live` stays `false` by design.

## Check

```
node --experimental-strip-types src/lib/sorankWebhook.check.ts
```

Asserts the documented shape and each alias/fallback path map onto the right
`blog` columns, and that a missing timestamp never produces a null / `"undefined"`
`created_at`.
