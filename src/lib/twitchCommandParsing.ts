import emojiRegex from "emoji-regex";

const BORDER_TYPE = "solid";

const emojiRe = emojiRegex();

function isEmojiOnly(str: string): boolean {
  if (!str) return false;
  return str.replace(emojiRe, "") === "";
}

export interface CommandPayload {
  display: string;
  content: string;
  type: "image" | "emoji";
}

// Ported from join-milo-bot/index.js — same trigger/payload parsing so
// behavior stays identical between the standalone bot script and this
// in-browser connector.
export function buildCommandPayload(
  text: string,
  triggerLower: string,
  defaultDisplayName: string,
): CommandPayload {
  const afterTrigger = text.trimStart().slice(triggerLower.length).trim();
  const parts = afterTrigger.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    if (isEmojiOnly(first)) {
      return {
        display: first,
        content: parts.slice(1).join(" "),
        type: "emoji",
      };
    }
    return {
      display: defaultDisplayName,
      content: parts.slice(1).join(" "),
      type: "image",
    };
  }
  return {
    display: defaultDisplayName,
    content: parts[0] ?? "",
    type: "image",
  };
}

interface HopeWallBodyInput extends CommandPayload {
  avatarUrl?: string;
}

// happyWallId and browserSignature are intentionally NOT set here — the
// relay route (/api/twitch/sessions/[token]/relay) always overrides both
// server-side from the session's own DB row, since browserSignature is a
// per-session secret the browser must never get to choose.
export function buildHopeWallBody(
  payload: HopeWallBodyInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    pseudo: payload.display,
    content: payload.content,
    type: payload.type,
    border_type: BORDER_TYPE,
  };
  if (payload.type === "image" && payload.avatarUrl) body.url = payload.avatarUrl;
  if (payload.type === "emoji") body.emoji = payload.display;
  return body;
}

export function parseApiErrorMessage(status: number, errorText: string): string {
  let errorMessage = `${status}: ${errorText}`;
  try {
    const body = JSON.parse(errorText);
    if (typeof body.message === "string" && body.message) errorMessage = body.message;
    else if (typeof body.error === "string" && body.error) errorMessage = body.error;
    else if (typeof body.detail === "string" && body.detail) errorMessage = body.detail;
  } catch {
    // keep status + errorText fallback
  }
  return errorMessage;
}

export interface PostResult {
  ok: boolean;
  status?: number;
  errorMessage?: string;
  messageId?: number | null;
}

export async function postToHopeWall(
  url: string,
  body: Record<string, unknown>,
): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const errorText = await res.text();
    return {
      ok: false,
      status: res.status,
      errorMessage: parseApiErrorMessage(res.status, errorText),
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

// Goes through /api/twitch/sessions/[token]/relay instead of fetching the
// channel's target_url directly from the browser — many wall endpoints
// (e.g. happy-milo.com's) send no CORS headers, since they were only ever
// built for server-to-server calls from join-milo-bot.
export async function relayToHopeWall(
  shareToken: string,
  body: Record<string, unknown>,
): Promise<PostResult> {
  try {
    const res = await fetch(`/api/twitch/sessions/${shareToken}/relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.errorMessage) {
      return { ok: false, errorMessage: data.errorMessage ?? data.error };
    }
    if (data.ok) return { ok: true, messageId: data.messageId ?? null };
    return {
      ok: false,
      status: data.status,
      errorMessage: parseApiErrorMessage(data.status, data.body ?? ""),
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}
