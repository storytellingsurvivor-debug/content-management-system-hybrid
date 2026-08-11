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
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const payload = await request.json();

  const sql = getSql();
  const [row] = await sql`
    select c.target_url
    from sessions s
    join channels c on c.id = s.channel_id
    where s.share_token = ${token}
  `;
  if (!row) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  try {
    const res = await fetch(row.target_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text();
    return Response.json({ ok: res.ok, status: res.status, body: bodyText });
  } catch (err) {
    return Response.json({
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error.",
    });
  }
}
