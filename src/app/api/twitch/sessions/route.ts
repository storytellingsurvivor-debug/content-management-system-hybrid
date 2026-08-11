import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/twitchBotDb";
import type { TwitchSessionRow } from "@/types/twitchBot";

const DEFAULT_TRIGGER = "!happy_wall";
const DEFAULT_SUCCESS_MESSAGE = "sent to the wall!";

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "session";
}

// Personalized instead of a raw hex blob (e.g. "yesromae-3f9a21c7b0e64d18")
// while keeping 64 bits of randomness in the suffix — this is still the
// entire access control for the public /session/[token] link, so it can't
// just be the readable part alone.
function generateShareToken(twitchChannel: string): string {
  return `${slugify(twitchChannel)}-${randomBytes(8).toString("hex")}`;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const channelId = String(body.channel_id ?? "").trim();
  if (!channelId) {
    return Response.json({ error: "channel_id is required." }, { status: 400 });
  }

  const sql = getSql();

  const [channel] = await sql`
    select id, twitch_channel from channels where id = ${channelId}
  `;
  if (!channel) {
    return Response.json({ error: "Channel not found." }, { status: 404 });
  }

  await sql`
    update channels set last_used_at = now() where id = ${channelId}
  `;

  const shareToken = generateShareToken(channel.twitch_channel);

  const [session] = (await sql`
    insert into sessions (channel_id, share_token, trigger_command, success_message)
    values (${channelId}, ${shareToken}, ${DEFAULT_TRIGGER}, ${DEFAULT_SUCCESS_MESSAGE})
    returning id, share_token, channel_id, trigger_command, success_message,
      status, status_detail, disconnect_requested, created_at, connected_at, disconnected_at
  `) as TwitchSessionRow[];

  return Response.json({ session }, { status: 201 });
}
