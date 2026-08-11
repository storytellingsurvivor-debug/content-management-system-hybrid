import { neon } from "@neondatabase/serverless";

// Twitch bot data (channels, live sessions, chat message log) lives in its
// own Neon Postgres database — deliberately separate from the CMS's
// Supabase project, with its own connection string and no shared
// credentials. See db/twitch-bot-schema.sql.
export function getSql() {
  const connectionString = process.env.TWITCH_BOT_DATABASE_URL;
  if (!connectionString) {
    throw new Error("TWITCH_BOT_DATABASE_URL is not set.");
  }
  return neon(connectionString);
}
