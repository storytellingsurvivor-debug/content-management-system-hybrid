import { getSql } from "@/lib/twitchBotDb";

// Deletes both the actual message on the live happy_wall (via
// happy-milo-core's DELETE /happy-wall/messages, using this session's own
// browser_signature as proof of ownership) and this app's own log entry.
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
    select s.id, s.browser_signature, c.target_url, c.happy_wall_id
    from sessions s
    join channels c on c.id = s.channel_id
    where s.share_token = ${token}
  `;
  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const [event] = await sql`
    select id, wall_message_id from session_events
    where id = ${numericEventId} and session_id = ${session.id}
  `;
  if (!event) {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  if (event.wall_message_id) {
    try {
      const res = await fetch(session.target_url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: event.wall_message_id,
          happyWallId: session.happy_wall_id,
          browserSignature: session.browser_signature,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return Response.json(
          {
            error:
              data.error ??
              `Could not delete the message from the wall (status ${res.status}).`,
          },
          { status: 502 },
        );
      }
    } catch (err) {
      return Response.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not reach the wall to delete the message.",
        },
        { status: 502 },
      );
    }
  }

  await sql`delete from session_events where id = ${numericEventId}`;

  return Response.json({ ok: true });
}
