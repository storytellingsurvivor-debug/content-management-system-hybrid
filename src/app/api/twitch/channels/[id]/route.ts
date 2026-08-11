import { getSql } from "@/lib/twitchBotDb";
import type { TwitchChannelRow } from "@/types/twitchBot";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = await request.json();

  const name = typeof body.name === "string" ? body.name.trim() : null;
  const twitchChannel =
    typeof body.twitch_channel === "string"
      ? body.twitch_channel.trim().toLowerCase()
      : null;
  const wallUrl =
    typeof body.wall_url === "string" ? body.wall_url.trim() : null;
  const targetUrl =
    typeof body.target_url === "string" ? body.target_url.trim() : null;

  if (wallUrl) {
    try {
      new URL(wallUrl);
    } catch {
      return Response.json(
        { error: "wall_url must be a valid URL." },
        { status: 400 },
      );
    }
  }
  if (targetUrl) {
    try {
      new URL(targetUrl);
    } catch {
      return Response.json(
        { error: "target_url must be a valid URL." },
        { status: 400 },
      );
    }
  }

  const sql = getSql();
  const [channel] = (await sql`
    update channels set
      name = coalesce(${name}, name),
      twitch_channel = coalesce(${twitchChannel}, twitch_channel),
      wall_url = coalesce(${wallUrl}, wall_url),
      target_url = coalesce(${targetUrl}, target_url)
    where id = ${id}
    returning id, name, twitch_channel, wall_url, target_url, created_at, last_used_at
  `) as TwitchChannelRow[];

  if (!channel) {
    return Response.json({ error: "Channel not found." }, { status: 404 });
  }
  return Response.json({ channel });
}

// Cascades to that channel's sessions and session_events (see
// db/twitch-bot-schema.sql) — deleting a channel profile clears its bot
// session history too.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const sql = getSql();
  const [deleted] = await sql`
    delete from channels where id = ${id} returning id
  `;
  if (!deleted) {
    return Response.json({ error: "Channel not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
