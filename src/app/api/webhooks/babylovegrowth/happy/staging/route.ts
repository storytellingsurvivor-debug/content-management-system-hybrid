import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_STAGING!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!,
);

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  // Use max(id)+1, not count+1: once any row has been deleted the count is
  // smaller than the real max id, so count+1 collides with an existing row and
  // the insert fails with a duplicate-key ("blog_pkey") 500.
  const { data: maxRows, error: maxError } = await supabase
    .from("blog")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  if (maxError) {
    console.error("[happy/staging] max-id lookup failed:", maxError);
    return Response.json({ error: maxError }, { status: 500 });
  }

  const topId = Number(maxRows?.[0]?.id ?? 0);
  const nextId = (Number.isFinite(topId) ? topId : 0) + 1;

  console.log("[happy/staging] Blog next id:", nextId);

  const row = {
    id: nextId,
    title: body.title,
    slug: body.slug,
    cover_image_url: body.heroImageUrl,
    content: body.content_markdown,
    language: body.languageCode,
    seo_keywords:
      Array.isArray(body.keywords) && body.keywords.length > 0
        ? body.keywords.join(", ")
        : null,
    meta_description: body.metaDescription,
    created_at: body.createdAt,
    author_name: "Milo",
    author_image_url:
      "https://sffejjhgtqzrdhudminu.supabase.co/storage/v1/object/public/milo-channel/happy-milo/email/happy-milo-avatar-linkedin-signature.webp",
    category: "Actualités",
    read_time_in_minutes: 5,
    is_live: false,
  };

  const result = await supabase.from("blog").insert(row);

  console.log(
    "[happy/staging] Final Supabase result:",
    JSON.stringify(result, null, 2),
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ status: "ok" }, { status: 200 });
}
