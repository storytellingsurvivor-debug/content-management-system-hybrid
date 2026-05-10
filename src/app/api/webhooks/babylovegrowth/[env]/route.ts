import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

type Env = "staging" | "prod";

// 1. Explicitly define the payload interface.
// This resolves the TypeScript "Property does not exist" errors that block deployment.
interface WebhookPayload {
  slug?: string;
  title?: string;
  content_markdown?: string;
  heroImageUrl?: string;
  languageCode?: string;
  metaDescription?: string | null;
  createdAt?: string; // Pulled from your example payload
  [key: string]: any;
}

// 2. Whitelist allowed query parameters instead of blacklisting.
// This guarantees that random tracking query params appended by the webhook provider 
// never reach Supabase and crash the database with a "Column does not exist" error.
const ALLOWED_URL_PARAMS = new Set([
  "brand",
  "category",
  "author_name",
  "author_image_url",
]);

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

function mapPayload(
  body: WebhookPayload,
  params: URLSearchParams,
): Record<string, any> {
  const markdown = String(body.content_markdown ?? "");
  const mapped: Record<string, any> = {
    slug: body.slug,
    title: body.title,
    content: markdown,
    cover_image_url: body.heroImageUrl,
    language: body.languageCode,
    seo_keywords: body.metaDescription ?? null,
    read_time_in_minutes: estimateReadMinutes(markdown),
    is_live: false,
  };

  // Sync original creation date from payload if provided
  if (body.createdAt) {
    mapped.created_at = body.createdAt;
  }

  // Safely map only whitelisted URL query params overriding default DB values
  params.forEach((value, key) => {
    if (ALLOWED_URL_PARAMS.has(key)) {
      mapped[key] = value;
    }
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

  let body: WebhookPayload;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.slug ||
    !body.content_markdown ||
    !body.title ||
    !body.heroImageUrl ||
    !body.languageCode
  ) {
    return Response.json(
      {
        error:
          "Missing required fields: slug, title, content_markdown, heroImageUrl, languageCode",
      },
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

  console.log(`[webhook:${envParam}] target=${supabaseUrl.slice(0, 40)}`);
  console.log(`[webhook:${envParam}] payload=${JSON.stringify(mapped)}`);

  const { data, error } = await supabase
    .from("blog")
    .insert(mapped)
    .select("*")
    .single();

  if (error) {
    console.error(
      `[webhook:${envParam}] error code=${error.code} details="${error.details}" message=${error.message}`,
    );

    if (error.code === "23505") {
      // Look up by slug — if this returns null, the conflict was on a different
      // constraint (likely the primary key), not the slug.
      const { data: existing } = await supabase
        .from("blog")
        .select("id, slug, is_live")
        .eq("slug", String(mapped.slug))
        .maybeSingle();

      console.log(
        `[webhook:${envParam}] duplicate lookup=${JSON.stringify(existing)}`,
      );

      return Response.json(
        {
          message: existing
            ? "Article already exists"
            : "Duplicate key conflict (not slug)",
          constraint: error.details,
          existing,
        },
        { status: 200 },
      );
    }

    return Response.json(
      { error: error.message, details: error.details },
      { status: 500 },
    );
  }

  console.log(
    `[webhook:${envParam}] inserted id=${data?.id} slug=${data?.slug}`,
  );
  return Response.json({ article: data }, { status: 200 });
}
