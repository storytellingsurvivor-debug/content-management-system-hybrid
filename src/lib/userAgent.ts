// Lightweight, dependency-free user-agent parsing.
//
// We only need coarse buckets (browser family, OS, device type) for analytics
// — not exact versions — so a small heuristic beats pulling in a parser
// dependency. Order matters: more specific tokens are checked first because
// many UAs lie (Edge contains "Chrome", Chrome on iOS contains "Safari", etc.).

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: "mobile" | "tablet" | "desktop" | "bot";
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|lighthouse|headless|preview|monitor|pingdom/i;

export function detectBrowser(ua: string): string {
  // Check impostors before the families whose token they borrow.
  if (/edg(a|ios|e)?\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/ucbrowser/i.test(ua)) return "UC Browser";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  // Chrome for iOS reports "CriOS"; real Safari never contains Chrome/CriOS.
  if (/crios/i.test(ua)) return "Chrome";
  if (/chrome|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

export function detectOs(ua: string): string {
  if (/windows nt/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  // iPadOS 13+ can masquerade as macOS; keep this after Android, before macOS.
  if (/iphone|ipod/i.test(ua)) return "iOS";
  if (/ipad/i.test(ua)) return "iPadOS";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

export function detectDeviceType(
  ua: string,
): ParsedUserAgent["deviceType"] {
  if (BOT_PATTERN.test(ua)) return "bot";
  if (/ipad|tablet|(android(?!.*mobile))|kindle|silk|playbook/i.test(ua)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? "").trim();
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", deviceType: "desktop" };
  }
  if (BOT_PATTERN.test(ua)) {
    return { browser: "Bot", os: detectOs(ua), deviceType: "bot" };
  }
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    deviceType: detectDeviceType(ua),
  };
}

// Reduce a referrer URL to a stable host we can group on ("google.com").
export function referrerHost(referrer: string | null | undefined): string | null {
  const raw = (referrer ?? "").trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
