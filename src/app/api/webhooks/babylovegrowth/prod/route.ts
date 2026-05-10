import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_PROD!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_PROD!,
);

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  const { count, error: countError } = await supabase
    .from("blog")
    .select("*", { count: "exact", head: true });

  console.log("[prod] Blog count:", count, "countError:", countError);

  const row = {
    id: (count ?? 0) + 1,
    title: body.title,
    slug: body.slug,
    cover_image_url: body.heroImageUrl,
    content: body.content_html,
    language: body.languageCode,
    seo_keywords: body.metaDescription ?? null,
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
