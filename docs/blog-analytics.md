# Blog analytics (readers, browsers & traffic sources)

Readership lives inside the **Blog articles** tab, next to create / update /
delete — there is no separate analytics tab. It is read-only: the CMS does
**not** create a table and does **not** ship a tracker. The public Milo sites
already record readership, and the CMS just aggregates what they wrote.

```
Public site (Happy/Forever/Support Milo)      Supabase            CMS (this app)
────────────────────────────────────────      ────────────        ──────────────
recordBlogView()      ──insert──▶  blog_views  ──┐
postBrowserCheckIn()  ──insert──▶  browsers    ──┴──select──▶  AnalyticsSection
```

## The two tables it reads

`blog_views` — one row per **(article, browser)** pair. The site checks for an
existing row before inserting, so a row means "this browser read this article",
not "one page hit". Repeat visits are never double-counted.

| column              | meaning                                       |
| ------------------- | --------------------------------------------- |
| `blog_id`           | points at `blog.id` (a specific language row)  |
| `browser_signature` | opaque visitor id, joins to `browsers`         |
| `has_viewed`        | text `"true"` / `"false"`                      |
| `has_liked`         | text `"true"` / `"false"`                      |
| `created_at`        | first read timestamp                           |

`browsers` — one row per visitor browser, written on first visit.

| column              | meaning                                    |
| ------------------- | ------------------------------------------ |
| `browser_signature` | primary key                                |
| `device`            | device string recorded by the site         |
| `user_agent`        | raw UA — browser family & OS are parsed from this at read time (`src/lib/userAgent.ts`) |
| `url_source`        | URL the visitor first landed on            |

Note `browsers` covers the **whole site**, not just blog readers, so the CMS
only fetches the signatures that appear in `blog_views` (chunked `.in()`).

## What you see

Each card shows its own **visit count** — human reads with robots and bots
excluded (an eye icon in the card footer). A view counts as robotic when the
`browsers` row for its signature has a bot `user_agent` (crawler, spider,
link-preview fetcher, headless monitor…), classified by `src/lib/userAgent.ts`.
A signature with no `browsers` row cannot be judged, so it is kept as human.

The controls row adds a **Filter by category** dropdown (built from the
`category` values present on the loaded articles) and a **Sort by** control:
_Most visited_ / _Least visited_ order the cards by that same bot-excluded
visit count. Sorting is available only when the analytics tables exist.

Under the article cards sits one **collapsible** panel — closed by default, so
it stays out of the way. Its toggle always shows the headline count. Select a
card and the panel reports that article; deselect ("Clear selection") and it
summarises every article at once.

- **Reads** — rows in `blog_views` (scoped to the selected article).
- **Unique visitors** — distinct `browser_signature`.
- **Likes** — rows with `has_liked = "true"`.
- **First reads · last 30 days** — daily buckets of `created_at`. It is a *first
  read* series by construction, since a row is only inserted once per browser.
- **Browsers / Operating systems** — derived from `browsers.user_agent`.
- **Devices** — `browsers.device`, falling back to the parsed UA when empty.
- **Traffic sources / Landing URLs** — host and raw value of `browsers.url_source`.

## What it deliberately does not do

No UTM breakdown and no referrer domains: neither is stored. `url_source` is the
closest signal available. Adding real acquisition data means changing what the
**public site** records, not adding a second tracking pipeline in the CMS.

## Checks

```
node --experimental-strip-types src/lib/blogAnalytics.check.ts
node --experimental-strip-types src/lib/blogFormSchema.check.ts
```

The second one pins which blog columns stay writable — notably `created_at`,
which the editor must be able to change after creation (back-dating an article
moves it in the blog ordering). Only `id` and `updated_at` are DB-owned.
