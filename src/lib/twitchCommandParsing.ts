import emojiRegex from "emoji-regex";

const BORDER_TYPE = "solid";
const BROWSER_SIGNATURE = "twitch-bot-command";

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

export function buildHopeWallBody(
  happyWallId: string,
  payload: HopeWallBodyInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    happyWallId,
    pseudo: payload.display,
    content: payload.content,
    type: payload.type,
    border_type: BORDER_TYPE,
    browserSignature: BROWSER_SIGNATURE,
  };
  if (payload.type === "image" && payload.avatarUrl) body.url = payload.avatarUrl;
  if (payload.type === "emoji") body.emoji = payload.display;
  return body;
}

function parseApiErrorMessage(status: number, errorText: string): string {
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
