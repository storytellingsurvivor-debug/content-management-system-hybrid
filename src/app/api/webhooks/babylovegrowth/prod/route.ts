import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_PROD!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_PROD!,
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
    console.error("[prod] max-id lookup failed:", maxError);
    return Response.json({ error: maxError }, { status: 500 });
  }

  const topId = Number(maxRows?.[0]?.id ?? 0);
  const nextId = (Number.isFinite(topId) ? topId : 0) + 1;

  console.log("[prod] Blog next id:", nextId);

  const row = {
    id: nextId,
    title: body.title,
    slug: body.slug,
    cover_image_url: body.heroImageUrl,
    content_markdown: body.content_markdown,
    content_format: "markdown",
    language: body.languageCode,
    seo_keywords:
      Array.isArray(body.keywords) && body.keywords.length > 0
        ? body.keywords.join(", ")
        : null,
    meta_description: body.metaDescription,
    created_at: body.createdAt,
    // TODO: replace fakes below with real data
    author_name: "Milo",
    author_image_url:
      "https://sffejjhgtqzrdhudminu.supabase.co/storage/v1/object/public/milo-channel/blog/tu-nes-pas-seul-force-de-demander-aide/author/author.webp",
    category: "support",
    read_time_in_minutes: 5,
    is_live: false,
  };

  const result = await supabase.from("blog").insert(row);

  console.log(
    "[prod] Final Supabase result:",
    JSON.stringify(result, null, 2),
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ status: "ok" }, { status: 200 });
}
