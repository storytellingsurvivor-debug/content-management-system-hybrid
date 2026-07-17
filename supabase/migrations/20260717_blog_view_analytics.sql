-- Blog view analytics
-- ---------------------------------------------------------------------------
-- One row per article view. The public blog site sends a lightweight event
-- (through the CMS ingestion route /api/blog/track); the CMS reads aggregates
-- from this table to power the Analytics tab.
--
-- Design notes:
--   * We keep raw events (not a counter) so we can slice by browser, device,
--     referrer/landing source and time. Aggregation happens at read time.
--   * `article_id` is intentionally NOT a hard foreign key: the public site may
--     only know the slug, and we never want a tracking insert to fail because a
--     row was renumbered. `article_slug` is always captured.
--   * No PII: we do not store IP or raw cookies. `visitor_hash` is an optional
--     opaque, salted hash the tracker can send to approximate unique visitors.

create table if not exists public.blog_view (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),

  -- which article
  article_id    bigint,
  article_slug  text not null,
  language      text,

  -- where the visitor came from (SEO / acquisition)
  landing_url   text,          -- full URL of the article page that was viewed
  referrer      text,          -- document.referrer (previous page / search engine)
  referrer_host text,          -- parsed host of the referrer, e.g. "google.com"
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,

  -- who / with what (derived from the user-agent, never the raw UA storage need)
  browser       text,          -- e.g. "Chrome", "Safari", "Firefox"
  os            text,          -- e.g. "iOS", "Android", "Windows", "macOS"
  device_type   text,          -- "mobile" | "tablet" | "desktop" | "bot"

  -- coarse de-duplication of unique visitors (optional, opaque)
  visitor_hash  text
);

create index if not exists blog_view_article_slug_idx on public.blog_view (article_slug);
create index if not exists blog_view_article_id_idx   on public.blog_view (article_id);
create index if not exists blog_view_created_at_idx    on public.blog_view (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Least privilege:
--   * The CMS dashboard connects with the anon key in the browser and only
--     needs to READ aggregates  -> anon SELECT allowed.
--   * Ingestion of new views goes through the server route with the SERVICE
--     ROLE key (which bypasses RLS), so we deliberately do NOT grant anon
--     INSERT. This keeps the public anon key from being able to spam rows.
alter table public.blog_view enable row level security;

drop policy if exists "blog_view anon read" on public.blog_view;
create policy "blog_view anon read"
  on public.blog_view
  for select
  to anon, authenticated
  using (true);

-- (Intentionally no INSERT policy for anon/authenticated: writes come from the
--  service-role ingestion route only. If you prefer the public site to insert
--  directly with the anon key instead of going through /api/blog/track, add:
--
--  create policy "blog_view anon insert"
--    on public.blog_view for insert to anon with check (true);
-- )
