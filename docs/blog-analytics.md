# Blog analytics (views, browsers & traffic sources)

This feature turns the CMS into a light back-office for measuring how each blog
article performs: total views, unique visitors, browser / device breakdown and
where the traffic came from (referrer domain, landing URL, UTM source).

It has three moving parts:

```
Public blog article page          CMS (this app)                 Supabase
─────────────────────────         ───────────────────            ─────────────
public/blog-tracker.js  ──POST──▶ /api/blog/track  ──insert──▶  blog_view table
                                  AnalyticsSection ◀──select───  (RLS: anon read)
```

## 1. Create the table

Run the migration in the Supabase SQL editor (once per project / environment):

```
supabase/migrations/20260717_blog_view_analytics.sql
```

It creates the `blog_view` table, indexes and Row Level Security:

- **anon SELECT** is allowed → the CMS dashboard (browser, anon key) can read
  aggregates.
- **no anon INSERT** → writes only happen through the ingestion route using the
  service-role key, so the public anon key can't be used to spam rows.

If you would rather have the public site insert directly with the anon key (no
server route), uncomment the `blog_view anon insert` policy at the bottom of the
migration and point the tracker's `data-endpoint` at PostgREST instead.

## 2. Configure the ingestion route

`/api/blog/track` (in this app) enriches each event with the parsed user-agent
and inserts it with the **service-role** key. It reads the same environment
variables the existing webhooks use:

| Env var                             | Used for            |
| ----------------------------------- | ------------------- |
| `SUPABASE_URL_PROD`                 | prod project URL    |
| `SUPABASE_SERVICE_ROLE_KEY_PROD`    | prod service role   |
| `SUPABASE_URL_STAGING`              | staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | staging service role|

The tracker picks the environment with `data-env="prod"` (default) or
`data-env="staging"`.

> Service-role keys are server-only. They must **never** appear in the public
> site or in browser code — the tracker only talks to `/api/blog/track`.

## 3. Add the tracker to public article pages

Include the script on each article page. It sends one anonymous event per page
load (no cookies, no IP, no PII — only a random opaque id in `localStorage` to
approximate unique visitors):

```html
<script
  src="https://<your-cms-domain>/blog-tracker.js"
  data-slug="tu-nes-pas-seul"   <!-- omit to infer from the URL's last segment -->
  data-article-id="42"          <!-- optional -->
  data-language="fr"            <!-- optional -->
  data-env="prod"               <!-- "prod" (default) | "staging" -->
  defer
></script>
```

- The endpoint defaults to the script's own origin + `/api/blog/track`. If the
  CMS is deployed elsewhere, set `data-endpoint="https://.../api/blog/track"`.
- UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`) and
  `document.referrer` are captured automatically from the visitor's URL.

### Sending events yourself (SPA / server)

Any client can POST JSON instead of using the script:

```
POST /api/blog/track
Content-Type: application/json

{
  "slug": "tu-nes-pas-seul",
  "article_id": 42,
  "language": "fr",
  "env": "prod",
  "landing_url": "https://happymilo.com/blog/tu-nes-pas-seul?utm_source=newsletter",
  "referrer": "https://www.google.com/",
  "utm_source": "newsletter",
  "visitor_hash": "b2c1..."
}
```

Only `slug` is required. `browser`, `os`, `device_type` and `referrer_host` are
derived server-side, so you don't send them.

## 4. Read the analytics

Open the CMS, connect to the brand's Supabase, and use the **Blog analytics**
tab:

- Pick **All articles** for the site-wide view + a "top articles" leaderboard,
  or a single article to drill in.
- KPI tiles: total views, unique visitors, last 7 / 30 days.
- A 30-day daily views bar chart.
- Distribution bars: browsers, devices, traffic sources (UTM / referrer),
  operating systems, referrer domains and landing URLs.

If the tab says the table doesn't exist yet, run step 1 and click **Re-check**.
