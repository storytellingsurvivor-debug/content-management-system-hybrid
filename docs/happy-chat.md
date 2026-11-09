# Happy Chat tables and the CMS key

The **Happy Chat** tab has two panels:

- **Situations**: `public.happy_chat_situation`, the situation pages, active and inactive.
- **AI config**: `public.happy_chat_ai_config`, the settings the chat uses: model, prompt, limits and author.

The CMS lists every row it reads and does not filter on `is_active`.
Row Level Security (RLS) on the database decides what the CMS key can read.
The site's public policy only shows `is_active = true` situations to the
`anon` role, so a CMS connected with the anon key never sees inactive situations.
It cannot update them either: the update comes back with 0 rows.

## Give the CMS access

Run the SQL below in the Supabase SQL editor of **each** project the CMS
connects to (staging and prod). It follows the `cms anon all <table>`
convention the other CMS-edited tables use.

```sql
-- Situations: read and write every row, inactive drafts included.
drop policy if exists "cms anon all happy_chat_situation" on public.happy_chat_situation;
create policy "cms anon all happy_chat_situation"
  on public.happy_chat_situation
  for all
  to anon
  using (true)
  with check (true);

-- AI config: read and write every row.
alter table public.happy_chat_ai_config enable row level security;
drop policy if exists "cms anon all happy_chat_ai_config" on public.happy_chat_ai_config;
create policy "cms anon all happy_chat_ai_config"
  on public.happy_chat_ai_config
  for all
  to anon
  using (true)
  with check (true);

grant select, insert, update, delete on public.happy_chat_situation to anon;
grant select, insert, update, delete on public.happy_chat_ai_config to anon;
```

### Security note

The anon key is public: the site ships it to every browser. With these
policies, anyone holding it can read inactive situation drafts and **read
and rewrite the chat's AI config**, prompt included. For the AI config,
the safer option is to skip its policy and connect the CMS with a key that
bypasses RLS (the legacy `service_role` JWT) when you edit it. Keep that key
out of the site and out of shared browsers.

## Only one active AI config

A partial unique index (`happy_chat_ai_config_single_active_key`) allows only
one row with `is_active = true`. When you save a config with "Is Active" on,
the CMS first turns `is_active` off on the other row, then saves yours. If
the save fails, the CMS turns the previous row back on.

Empty "Reasoning effort", "Text verbosity", "Temperature" and "Author image URL"
are saved as `NULL`, so the provider defaults apply.
