import { getSql } from "@/lib/twitchBotDb";

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
