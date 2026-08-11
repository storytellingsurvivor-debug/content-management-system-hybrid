// Serves the bot account's own Twitch credentials to the owner-side /twitch
// UI so they don't have to be re-pasted into a form every time. Only ever
// called from the CMS's own Twitch bot panel — never from the public
// /session/[token] page, so a moderator holding that link never reaches
// this route or these values.
export async function GET(): Promise<Response> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN;
  const refreshToken = process.env.TWITCH_REFRESH_TOKEN;

  if (!clientId || !accessToken || !refreshToken) {
    return Response.json(
      {
        error:
          "TWITCH_CLIENT_ID / TWITCH_ACCESS_TOKEN / TWITCH_REFRESH_TOKEN not configured.",
      },
      { status: 500 },
    );
  }

  return Response.json({
    client_id: clientId,
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
