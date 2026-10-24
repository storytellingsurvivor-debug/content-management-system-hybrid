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
| `has_liked`         | not used — the blog pages only record views    |
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

The controls row adds a **Filter by category** dropdown and a **Sort by**
control. The category options are scoped to the chosen language — pick a
language and the dropdown lists only the categories that exist for it (all
categories when no language is selected); a category the new language lacks is
cleared so the filters can't combine into an always-empty result. **Sort by**:
_Most visited_ / _Least visited_ order the cards by that same bot-excluded
visit count. Sorting is available only when the analytics tables exist.

Under the article cards sits one **collapsible** panel — closed by default, so
it stays out of the way. Its toggle always shows the headline count. Select a
card and the panel reports that article; deselect ("Clear selection") and it
summarises every article at once.

- **Reads** — rows in `blog_views` (scoped to the selected article).
- **Unique visitors** — distinct `browser_signature`.
- **First reads · last 30 days** — daily buckets of `created_at`. It is a *first
  read* series by construction, since a row is only inserted once per browser.
- **Browsers / Operating systems** — derived from `browsers.user_agent`.
- **Devices** — `browsers.device`, falling back to the parsed UA when empty.
- **Traffic sources / Landing URLs** — host and raw value of `browsers.url_source`.

## Performance overview (global ranking)

Its own section, **Performance overview** (5 by default), on the Blog
articles tab. Readership answers "how is *this* article
doing"; this one answers "how are *all* my articles doing" in one screen.

It is closed by default and only fetches `blog_views` / `browsers` the first
time you open it (the refresh button reloads). It has its own **Language** and
**Status** filters, excludes robots & bots, and is computed in
`src/lib/articlePerformance.ts`. Clicking an article selects it in sections 2–3
and scrolls back up to them.

- **KPIs** — articles, reads, reads in the last 30 days, reads per article, and
  **Live but dormant** (online and nobody reads them).
- **By category** — articles, live, reads, reads / article, reads / week,
  last 30 days, dormant count and best article. Click a row to narrow the
  ranking to that category.
- **Ranking** — one row per article, sortable by any metric. Click a row to
  open the article in the editor. **Export CSV** downloads the current view.
  - *Reads / week* = reads ÷ weeks online (min. 1 week). Default sort: it is
    fair to old articles and recent ones alike, unlike raw reads.
  - *Online* = days since `published_at`, falling back to `created_at`.
  - *Trend* = last 30 days vs the 30 days before.
- **Health** labels (chips are also filters):

| label   | rule                                                            |
| ------- | --------------------------------------------------------------- |
| New     | online < 14 days — too early to judge                            |
| Dormant | no human read for 60+ days, or never read                        |
| Top     | upper quartile of reads / week, and read in the last 30 days     |
| Rising  | ≥ 3 reads in the last 30 days and ≥ 1.5× the 30 days before      |
| Fading  | ≥ 3 reads in the previous 30 days and now ≤ half of that         |
| Steady  | everything else                                                  |

Limits: the CMS loads the newest 20 000 `blog_views` rows, so all-time totals
on a very large table cover that window only. Reads are first reads per browser
(`blog_views` is de-duplicated), not page hits.

## What it deliberately does not do

No UTM breakdown and no referrer domains: neither is stored. `url_source` is the
closest signal available. Adding real acquisition data means changing what the
**public site** records, not adding a second tracking pipeline in the CMS.

## Section layout

On the Blog articles tab, the sections after **2. Articles & readership** —
Content, Bucket / Media and Performance overview — each have **Show / Hide**
and **move up / move down** controls. Their numbers follow the order. Order and
open/closed state are remembered per browser (`localStorage`, see
`src/lib/sectionLayout.ts`); hidden Content and Bucket stay mounted, so a
half-edited article or an open folder survives hiding. On the other tabs
Bucket / Media keeps its usual place, with Show / Hide only.

## Checks

```
node --experimental-strip-types src/lib/blogAnalytics.check.ts
node --experimental-strip-types src/lib/articlePerformance.check.ts
node --experimental-strip-types src/lib/sectionLayout.check.ts
node --experimental-strip-types src/lib/blogFormSchema.check.ts
```

The second one pins which blog columns stay writable — notably `created_at`,
which the editor must be able to change after creation (back-dating an article
moves it in the blog ordering). Only `id` and `updated_at` are DB-owned.
