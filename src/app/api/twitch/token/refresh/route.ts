// Refreshes a Twitch user access token on behalf of the bot's connected
// browser tab. The client secret must never reach the browser, so the
// refresh call to Twitch happens here, server-side, using
// TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET env vars — the browser only ever
// holds the resulting short-lived access token.
export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const refreshToken = String(body.refresh_token ?? "").trim();
  if (!refreshToken) {
    return Response.json(
      { error: "refresh_token is required." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json(
      { error: data.message ?? "Twitch token refresh failed." },
      { status: res.status },
    );
  }

  return Response.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
