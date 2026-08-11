import { getSql } from "@/lib/twitchBotDb";
import type { TwitchSessionEventRow } from "@/types/twitchBot";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const body = await request.json();

  const twitchUsername = String(body.twitch_username ?? "").trim();
  const displayName = String(body.display_name ?? "").trim();
  const rawMessage = String(body.raw_message ?? "");
  const content = String(body.content ?? "");
  const messageType = body.message_type === "emoji" ? "emoji" : "image";
  const success = Boolean(body.success);
  const errorMessage =
    typeof body.error_message === "string" ? body.error_message : null;
  const wallMessageId =
    typeof body.wall_message_id === "number" ? body.wall_message_id : null;
  const imageUrl =
    typeof body.image_url === "string" && body.image_url ? body.image_url : null;

  if (!twitchUsername || !rawMessage) {
    return Response.json(
      { error: "twitch_username and raw_message are required." },
      { status: 400 },
    );
  }

  const sql = getSql();
  const [session] = await sql`
    select id from sessions where share_token = ${token}
  `;
  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const [event] = (await sql`
    insert into session_events (
      session_id, twitch_username, display_name, raw_message, content,
      message_type, success, error_message, wall_message_id, image_url
    )
    values (
      ${session.id}, ${twitchUsername}, ${displayName || twitchUsername},
      ${rawMessage}, ${content}, ${messageType}, ${success}, ${errorMessage},
      ${wallMessageId}, ${imageUrl}
    )
    returning id, session_id, twitch_username, display_name, raw_message,
      content, message_type, success, error_message, wall_message_id, image_url, created_at
  `) as TwitchSessionEventRow[];

  return Response.json({ event }, { status: 201 });
}
