import { createClient } from "@supabase/supabase-js";
import {
  handleSorankWebhook,
  type SorankBrand,
} from "@/lib/sorankWebhook";

const supabase = createClient(
  process.env.SUPABASE_URL_PROD!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_PROD!,
);

const brand: SorankBrand = {
  authorName: "Milo",
  authorImageUrl:
    "https://sffejjhgtqzrdhudminu.supabase.co/storage/v1/object/public/milo-channel/happy-milo/email/happy-milo-avatar-linkedin-signature.webp",
  category: "Actualités",
};

export async function POST(request: Request): Promise<Response> {
  return handleSorankWebhook(request, supabase, brand, "sorank/happy/prod");
}
