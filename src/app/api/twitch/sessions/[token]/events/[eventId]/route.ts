import { getSql } from "@/lib/twitchBotDb";

// Deletes a handled-message entry from this app's own log — NOT the actual
// message on the live happy_wall (that's a separate, not-yet-built piece;
// see conversation notes on why it needs a happy-milo-core change first).
// Scoped to session_id resolved from the token, so an event id can't be
// deleted via a token it doesn't belong to.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string; eventId: string }> },
): Promise<Response> {
  const { token, eventId } = await params;
  const numericEventId = Number(eventId);
  if (!Number.isInteger(numericEventId)) {
    return Response.json({ error: "Invalid event id." }, { status: 400 });
  }

  const sql = getSql();
  const [session] = await sql`
    select id from sessions where share_token = ${token}
  `;
  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const [deleted] = await sql`
    delete from session_events
    where id = ${numericEventId} and session_id = ${session.id}
    returning id
  `;
  if (!deleted) {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
