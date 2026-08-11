-- Twitch bot database schema — Neon Postgres.
-- Deliberately a separate database/project from the CMS's Supabase project:
-- this data (Twitch channel configs, live session state, chat message log)
-- has nothing to do with blog/happy_wall content and gets its own connection
-- string (DATABASE_URL) and its own access story (no shared credentials with
-- the CMS's Supabase anon/service-role keys).
--
-- Run this once against a fresh Neon database, e.g.:
--   psql "$DATABASE_URL" -f db/twitch-bot-schema.sql

create extension if not exists pgcrypto;

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- human label, e.g. "Milo main stream"
  twitch_channel text not null,       -- Twitch login name to join, e.g. "happymilo"
  happy_wall_id text not null,        -- target happy_wall id (as used in join-milo-bot's HAPPY_MILO_HAPPY_WALL_ID)
  target_url text not null,           -- endpoint messages get POSTed to (TARGET_HAPPY_MILO_TARGET_URL equivalent)
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

do $$ begin
  create type session_status as enum (
    'idle',
    'connecting',
    'connected',
    'disconnected',
    'error'
  );
exception when duplicate_object then null;
end $$;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  -- The public, unguessable URL key: /session/[share_token]. Deliberately a
  -- separate column from `id` so the sequential-ish uuid used for FKs is
  -- never the same value handed out in a shareable link.
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  channel_id uuid not null references channels(id) on delete cascade,
  trigger_command text not null default '!happy_wall',
  success_message text not null default 'sent to the wall!',
  -- Per-session ownership token sent as `browserSignature` on every wall
  -- post from this session, and required to delete those messages later
  -- (see happy-milo-core's DELETE /happy-wall/messages). Deliberately
  -- random per session rather than a shared constant — a fixed constant
  -- committed to this public repo would let anyone delete any
  -- bot-posted message on any wall.
  browser_signature text not null default encode(gen_random_bytes(16), 'hex'),
  status session_status not null default 'idle',
  status_detail text,
  -- Set by the public session page when a moderator clicks "Disconnect";
  -- the owner's connected browser tab polls this and honors it (only that
  -- tab holds the live Twitch chat connection).
  disconnect_requested boolean not null default false,
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  disconnected_at timestamptz
);

-- Safe to re-run against a DB created before browser_signature existed.
alter table sessions add column if not exists browser_signature text
  not null default encode(gen_random_bytes(16), 'hex');

create index if not exists sessions_channel_id_idx on sessions(channel_id);

create table if not exists session_events (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  twitch_username text not null,
  display_name text not null,
  raw_message text not null,
  content text not null,
  message_type text not null check (message_type in ('image', 'emoji')),
  success boolean not null,
  error_message text,
  -- id of the created happy_wall_message row, when the post succeeded —
  -- needed to actually delete it from the wall later. Null for failed
  -- posts (nothing was created) or events logged before this column
  -- existed.
  wall_message_id bigint,
  created_at timestamptz not null default now()
);

-- Safe to re-run against a DB created before wall_message_id existed.
alter table session_events add column if not exists wall_message_id bigint;

create index if not exists session_events_session_id_idx on session_events(session_id, created_at desc);
