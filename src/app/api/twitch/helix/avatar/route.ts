// Looks up a Twitch user's avatar URL via the Helix API. Uses an app access
// token (client-credentials grant), so the client secret stays server-side
// — the browser only ever asks this route for a login name and gets back a
// plain image URL.
let cachedAppToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return cachedAppToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
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
    throw new Error(data.message ?? "Failed to obtain Twitch app token.");
  }

  cachedAppToken = {
    token: data.access_token,
    // Refresh a minute early to avoid edge-of-expiry failures.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedAppToken.token;
}

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured." },
      { status: 500 },
    );
  }

  const login = new URL(request.url).searchParams.get("login")?.trim();
  if (!login) {
    return Response.json({ error: "login is required." }, { status: 400 });
  }

  try {
    const appToken = await getAppAccessToken(clientId, clientSecret);
    const res = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
      {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${appToken}`,
        },
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return Response.json(
        { error: data.message ?? "Helix lookup failed." },
        { status: res.status },
      );
    }

    const avatarUrl: string | undefined = data.data?.[0]?.profile_image_url;
    return Response.json({ avatar_url: avatarUrl ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
