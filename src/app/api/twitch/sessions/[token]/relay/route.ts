import { getSql } from "@/lib/twitchBotDb";

// Posts a handled command's payload to the channel's target_url on behalf
// of the browser. This exists because that POST used to happen directly
// from the browser and gets silently blocked by CORS on endpoints that
// were only ever built for server-to-server calls (e.g. happy-milo.com's
// /happy-wall/messages route sends no Access-Control-Allow-Origin header).
//
// The destination is resolved server-side from the session's channel —
// never taken from the request body — so this can't be used as an open
// relay to an arbitrary attacker-supplied URL.
//
// happyWallId and browserSignature are also always overridden here from
// the DB rather than trusted from the client body: browserSignature in
// particular is the per-session secret needed later to delete a message,
// and must never be something the browser gets to choose.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const clientPayload = await request.json();

  const sql = getSql();
  const [row] = await sql`
    select c.target_url, c.happy_wall_id, s.browser_signature
    from sessions s
    join channels c on c.id = s.channel_id
    where s.share_token = ${token}
  `;
  if (!row) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const payload = {
    ...clientPayload,
    happyWallId: row.happy_wall_id,
    browserSignature: row.browser_signature,
  };

  try {
    const res = await fetch(row.target_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text();

    let messageId: number | null = null;
    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed?.message?.id === "number") messageId = parsed.message.id;
    } catch {
      // upstream didn't return JSON — leave messageId null
    }

    return Response.json({
      ok: res.ok,
      status: res.status,
      body: bodyText,
      messageId,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error.",
    });
  }
}
