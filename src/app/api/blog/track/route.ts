import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseUserAgent, referrerHost } from "@/lib/userAgent";

// Ingestion endpoint for blog view analytics.
//
// The public blog site (a different origin) POSTs a small JSON payload here
// whenever an article page is viewed. We enrich it server-side with the parsed
// user-agent, then insert one row into `blog_view` using the Supabase SERVICE
// ROLE key. Writing happens server-side so the public anon key can never be
// used to spam the analytics table (RLS grants anon SELECT only).
//
// This route is intentionally best-effort: a tracking failure must never break
// a page view, so client errors still return 2xx-ish and we never leak details.

type Env = "staging" | "prod";

const CORS_HEADERS: Record<string, string> = {
  // The public site is a separate origin. No credentials are sent, so "*" is
  // safe and simplest (a beacon carries no cookies we rely on).
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function resolveEnv(value: unknown): Env {
  return value === "staging" ? "staging" : "prod";
}

function supabaseForEnv(env: Env): SupabaseClient | null {
  const url =
    env === "staging"
      ? process.env.SUPABASE_URL_STAGING
      : process.env.SUPABASE_URL_PROD;
  const key =
    env === "staging"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING
      : process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// sendBeacon often posts as text/plain, so parse defensively.
async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2048) : null;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);

  const slug = str(body.slug) ?? str(body.article_slug);
  if (!slug) {
    return json({ error: "slug is required" }, 400);
  }

  const env = resolveEnv(body.env);
  const supabase = supabaseForEnv(env);
  if (!supabase) {
    return json({ error: `Supabase not configured for env "${env}"` }, 500);
  }

  // Prefer the real request header; fall back to a UA the client passed
  // explicitly (useful when the tracker fires from a worker/beacon context).
  const userAgent =
    request.headers.get("user-agent") ?? str(body.user_agent) ?? "";
  const { browser, os, deviceType } = parseUserAgent(userAgent);

  const referrer = str(body.referrer);
  const rawId = body.article_id ?? body.id;
  const numericId = Number(rawId);
  const articleId =
    rawId !== undefined && rawId !== null && !Number.isNaN(numericId)
      ? numericId
      : null;

  const row = {
    article_id: articleId,
    article_slug: slug,
    language: str(body.language),
    landing_url: str(body.landing_url),
    referrer,
    referrer_host: referrerHost(referrer),
    utm_source: str(body.utm_source),
    utm_medium: str(body.utm_medium),
    utm_campaign: str(body.utm_campaign),
    browser,
    os,
    device_type: deviceType,
    visitor_hash: str(body.visitor_hash),
  };

  const { error } = await supabase.from("blog_view").insert(row);
  if (error) {
    console.error("[blog/track] insert failed:", error.message);
    return json({ error: "insert failed" }, 500);
  }

  return json({ status: "ok" }, 201);
}
