import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_STAGING!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!,
);

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  const { count, error: countError } = await supabase
    .from("blog")
    .select("*", { count: "exact", head: true });

  console.log("[happy/staging] Blog count:", count, "countError:", countError);

  const row = {
    id: (count ?? 0) + 1,
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
