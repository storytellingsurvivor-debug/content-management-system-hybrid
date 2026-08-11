import { getSql } from "@/lib/twitchBotDb";
import type { TwitchChannelRow } from "@/types/twitchBot";

export async function GET(): Promise<Response> {
  const sql = getSql();
  const rows = (await sql`
    select id, name, twitch_channel, happy_wall_id, target_url, created_at, last_used_at
    from channels
    order by last_used_at desc nulls last, created_at desc
  `) as TwitchChannelRow[];

  return Response.json({ channels: rows });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const twitchChannel = String(body.twitch_channel ?? "")
    .trim()
    .toLowerCase();
  const happyWallId = String(body.happy_wall_id ?? "").trim();
  const targetUrl = String(body.target_url ?? "").trim();

  if (!name || !twitchChannel || !happyWallId || !targetUrl) {
    return Response.json(
      {
        error:
          "name, twitch_channel, happy_wall_id and target_url are all required.",
      },
      { status: 400 },
    );
  }

  try {
    new URL(targetUrl);
  } catch {
    return Response.json(
      { error: "target_url must be a valid URL." },
      { status: 400 },
    );
  }

  const sql = getSql();
  const [channel] = (await sql`
    insert into channels (name, twitch_channel, happy_wall_id, target_url)
    values (${name}, ${twitchChannel}, ${happyWallId}, ${targetUrl})
    returning id, name, twitch_channel, happy_wall_id, target_url, created_at, last_used_at
  `) as TwitchChannelRow[];

  return Response.json({ channel }, { status: 201 });
}
