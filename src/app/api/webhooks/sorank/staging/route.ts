import { createClient } from "@supabase/supabase-js";
import {
  handleSorankWebhook,
  type SorankBrand,
} from "@/lib/sorankWebhook";

const supabase = createClient(
  process.env.SUPABASE_URL_STAGING!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!,
);

const brand: SorankBrand = {
  authorName: "Milo",
  authorImageUrl:
    "https://sffejjhgtqzrdhudminu.supabase.co/storage/v1/object/public/milo-channel/blog/tu-nes-pas-seul-force-de-demander-aide/author/author.webp",
  category: "support",
};

export async function POST(request: Request): Promise<Response> {
  return handleSorankWebhook(request, supabase, brand, "sorank/staging");
}
