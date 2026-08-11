import type { AccessTokenWithUserId, AuthProvider } from "@twurple/auth";

// Twurple's ChatClient refuses any AuthProvider that doesn't implement
// getAccessTokenForIntent (see @twurple/chat ChatClient.js: it throws
// InvalidTokenTypeError otherwise) — so a plain StaticAuthProvider is not
// enough here. RefreshingAuthProvider would work, but it needs the Twitch
// client secret in its constructor, and the secret must stay server-side
// (see /api/twitch/token/refresh). This class fills the same role as
// RefreshingAuthProvider from ChatClient's point of view, but proxies the
// actual refresh call through our own server route instead of holding the
// secret itself.
export class BrowserTwitchAuthProvider implements AuthProvider {
  readonly clientId: string;
  private token: AccessTokenWithUserId;

  constructor(clientId: string, initialToken: AccessTokenWithUserId) {
    this.clientId = clientId;
    this.token = initialToken;
  }

  getCurrentScopesForUser(): string[] {
    return this.token.scope;
  }

  async getAccessTokenForUser(): Promise<AccessTokenWithUserId> {
    return this.token;
  }

  async getAccessTokenForIntent(): Promise<AccessTokenWithUserId> {
    return this.token;
  }

  async getAnyAccessToken(): Promise<AccessTokenWithUserId> {
    return this.token;
  }

  async refreshAccessTokenForIntent(): Promise<AccessTokenWithUserId> {
    return this.refresh();
  }

  async refreshAccessTokenForUser(): Promise<AccessTokenWithUserId> {
    return this.refresh();
  }

  private async refresh(): Promise<AccessTokenWithUserId> {
    if (!this.token.refreshToken) {
      throw new Error("No refresh token available to refresh with.");
    }

    const res = await fetch("/api/twitch/token/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.token.refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Token refresh failed.");
    }

    this.token = {
      ...this.token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.token.refreshToken,
      expiresIn: data.expires_in ?? null,
      obtainmentTimestamp: Date.now(),
    };
    return this.token;
  }
}

interface ValidateTokenResult {
  userId: string;
  login: string;
  scopes: string[];
  clientId: string;
}

// Twitch's token validation endpoint doubles as a way to discover the
// bot account's user id/login from just the access token, without needing
// the client secret. Called directly from the browser (no CORS/secret
// issue — this endpoint is designed for client-side use).
export async function validateTwitchToken(
  accessToken: string,
): Promise<ValidateTokenResult> {
  const res = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "Twitch token validation failed.");
  }
  return {
    userId: data.user_id,
    login: data.login,
    scopes: data.scopes ?? [],
    clientId: data.client_id,
  };
}
