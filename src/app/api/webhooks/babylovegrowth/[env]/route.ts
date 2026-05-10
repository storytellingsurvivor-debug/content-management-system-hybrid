import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

// Give enough time for Supabase round-trip on large articles
export const maxDuration = 30;

type Env = "staging" | "prod";

function isTokenValid(incoming: string, expected: string): boolean {
  if (!expected || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

function estimateReadMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function getEnvVars(env: Env) {
  if (env === "prod") {
    return {
      secret: process.env.WEBHOOK_SECRET_PROD ?? "",
      supabaseUrl: process.env.SUPABASE_URL_PROD ?? "",
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD ?? "",
    };
  }
  return {
    secret: process.env.WEBHOOK_SECRET_STAGING ?? "",
    supabaseUrl: process.env.SUPABASE_URL_STAGING ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING ?? "",
  };
}

// Translates babylovegrowth field names → blog table columns.
// babylovegrowth owns data quality — no transformation, just rename.
// author_name, author_image_url, category, brand come from URL query params.
function mapPayload(
  body: Record<string, unknown>,
  params: URLSearchParams,
): Record<string, unknown> {
  const markdown = String(body.content_markdown ?? "");
  const mapped: Record<string, unknown> = {
    slug: body.slug,
    title: body.title,
    content: markdown,
    cover_image_url: body.heroImageUrl,
    language: body.languageCode,
    seo_keywords: body.metaDescription ?? null,
    read_time_in_minutes: estimateReadMinutes(markdown),
    is_live: false,
  };

  // author_name, author_image_url, category, brand come from URL query params
  params.forEach((value, key) => {
    mapped[key] = value;
  });

  return mapped;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ env: string }> },
): Promise<Response> {
  const { env: envParam } = await params;

  if (envParam !== "staging" && envParam !== "prod") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { secret, supabaseUrl, serviceKey } = getEnvVars(envParam);

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!isTokenValid(token, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.slug || !body.content_markdown || !body.title || !body.heroImageUrl || !body.languageCode) {
    return Response.json(
      { error: "Missing required fields: slug, title, content_markdown, heroImageUrl, languageCode" },
      { status: 400 },
    );
  }

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const mapped = mapPayload(body, searchParams);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("blog")
    .insert(mapped)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Already inserted — idempotent 200 so babylovegrowth doesn't mark as failed
      return Response.json(
        { message: "Article already exists", slug: mapped.slug },
        { status: 200 },
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ article: data }, { status: 200 });
}
