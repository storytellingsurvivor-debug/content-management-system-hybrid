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
  nothing mapped onto the required `title` / `slug` / `content` columns (all
  three are NOT NULL in the `blog` table). `receivedKeys` lists the keys Sorank
  actually sent, so the mapper can be pointed at them. This turns an otherwise
  opaque NOT NULL `500` into a self-describing response. The full payload is also
  logged (`[sorank/...] raw payload: …`) for the same reason.
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

Sorank wraps the article in an **envelope**: `event`, `delivery_id` and
`timestamp` at the top level, with the article fields nested under an `article`
object. `src/lib/sorankWebhook.ts` reads from `article` (and falls back to the
top level for a legacy flat payload), tolerating a couple of aliases per field.

| `blog` column | Read from Sorank `article.*` (first match wins) |
| ------------- | ----------------------------------------------- |
| `title` | `title` |
| `slug` | `slug` |
| `content` | `content` (full HTML body) |
| `cover_image_url` | `featured_image.url`, else first URL in `images[]` (each `{ url, alt, placement }`) |
| `language` | `language` — BCP-47 (`fr-FR`) normalised to the primary subtag (`fr`) to match existing rows |
| `seo_keywords` | `focus_keyphrase`, else `keyword` |
| `meta_description` | `meta_description` |
| `read_time_in_minutes` | derived from `word_count` (÷200 wpm, min 1); `5` if absent |
| `created_at` | top-level `timestamp` (falls back to `now()`) |

Fixed per route (not from the payload): `author_name`, `author_image_url`,
`category` (the brand defaults above) and `is_live: false` — new articles land
unpublished for review. `id` is `max(id) + 1`.

`event: "webhook.test"` (Sorank's connectivity probe) is acknowledged `200`
**without** inserting, so clicking "Test" doesn't create dummy rows; only
`event: "article.published"` (or a flat payload with no event) is ingested.

### Example payload (`article.published`)

```json
{
  "event": "article.published",
  "delivery_id": "11111111-2222-3333-4444-555555555555",
  "timestamp": "2026-08-28T21:23:09.000Z",
  "article": {
    "id": "art_123",
    "title": "Comment demander de l'aide",
    "slug": "comment-demander-de-l-aide",
    "meta_description": "Un guide court et concret.",
    "focus_keyphrase": "demander de l'aide",
    "content": "<h1>Bonjour</h1><p>…</p>",
    "featured_image": { "url": "https://cdn.example.com/cover.webp", "alt": "…", "placement": "top" },
    "images": [],
    "word_count": 800,
    "keyword": "demander de l'aide",
    "language": "fr-FR"
  }
}
```

## Assumptions & follow-ups

The mapping follows Sorank's documented field reference. Language is normalised
to the primary subtag (`fr-FR` → `fr`) to align with existing rows; drop the
normalisation if the site expects full BCP-47 tags. `is_live` stays `false` by
design (articles are reviewed before going live).

## Check

```
node --experimental-strip-types src/lib/sorankWebhook.check.ts
```

Asserts the real `article.published` envelope maps onto the right `blog`
columns, the language/read-time/cover-image helpers, the `webhook.test`
no-insert path, `max(id)+1` id assignment, and that an unmappable article
returns a 422 naming the received keys rather than an insert 500.
