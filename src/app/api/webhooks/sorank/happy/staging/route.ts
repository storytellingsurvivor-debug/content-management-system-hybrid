import { createClient } from "@supabase/supabase-js";
import { mapSorankArticle, type SorankBrand } from "@/lib/sorankWebhook";

const supabase = createClient(
  process.env.SUPABASE_URL_STAGING!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!,
);

const brand: SorankBrand = {
  authorName: "Milo",
  authorImageUrl:
    "https://sffejjhgtqzrdhudminu.supabase.co/storage/v1/object/public/milo-channel/happy-milo/email/happy-milo-avatar-linkedin-signature.webp",
  category: "Actualités",
};

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  const { count, error: countError } = await supabase
    .from("blog")
    .select("*", { count: "exact", head: true });

  console.log(
    "[sorank/happy/staging] Blog count:",
    count,
    "countError:",
    countError,
  );

  const row = mapSorankArticle(body, brand, (count ?? 0) + 1);

  const result = await supabase.from("blog").insert(row);

  console.log(
    "[sorank/happy/staging] Final Supabase result:",
    JSON.stringify(result, null, 2),
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ status: "ok" }, { status: 200 });
}
