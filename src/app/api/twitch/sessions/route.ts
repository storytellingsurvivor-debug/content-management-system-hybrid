import { getSql } from "@/lib/twitchBotDb";
import type { TwitchSessionRow } from "@/types/twitchBot";

const DEFAULT_TRIGGER = "!happy_wall";
const DEFAULT_SUCCESS_MESSAGE = "sent to the wall!";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const channelId = String(body.channel_id ?? "").trim();
  if (!channelId) {
    return Response.json({ error: "channel_id is required." }, { status: 400 });
  }

  const sql = getSql();

  const [channel] = await sql`
    select id from channels where id = ${channelId}
  `;
  if (!channel) {
    return Response.json({ error: "Channel not found." }, { status: 404 });
  }

  await sql`
    update channels set last_used_at = now() where id = ${channelId}
  `;

  const [session] = (await sql`
    insert into sessions (channel_id, trigger_command, success_message)
    values (${channelId}, ${DEFAULT_TRIGGER}, ${DEFAULT_SUCCESS_MESSAGE})
    returning id, share_token, channel_id, trigger_command, success_message,
      status, status_detail, disconnect_requested, created_at, connected_at, disconnected_at
  `) as TwitchSessionRow[];

  return Response.json({ session }, { status: 201 });
}
