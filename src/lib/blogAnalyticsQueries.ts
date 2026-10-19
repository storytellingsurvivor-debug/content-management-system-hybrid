import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BLOG_VIEWS_TABLE,
  BROWSERS_TABLE,
  type BlogViewRow,
  type BrowserRow,
} from "./blogAnalytics";

// Supabase reads behind blog analytics, shared by the Articles section and
// the Performance overview section.

// Page through the view rows, newest first, up to `MAX_ROWS` — enough to cover
// the windows we report on without unbounded client memory.
const ROWS_PER_PAGE = 1000;
const MAX_ROWS = 20000;

export async function fetchViewRows(
  client: SupabaseClient,
): Promise<BlogViewRow[]> {
  const all: BlogViewRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += ROWS_PER_PAGE) {
    const to = Math.min(from + ROWS_PER_PAGE, MAX_ROWS) - 1;
    const { data, error } = await client
      .from(BLOG_VIEWS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const batch = (data ?? []) as BlogViewRow[];
    all.push(...batch);
    if (batch.length < ROWS_PER_PAGE) break;
  }
  return all;
}

// `browsers` covers every site visitor, not just blog readers, so fetch only
// the signatures we saw — chunked, to keep the request URL short.
export async function fetchBrowsers(
  client: SupabaseClient,
  signatures: string[],
): Promise<Map<string, BrowserRow>> {
  const bySignature = new Map<string, BrowserRow>();
  const CHUNK = 200;
  for (let i = 0; i < signatures.length; i += CHUNK) {
    const { data, error } = await client
      .from(BROWSERS_TABLE)
      .select("*")
      .in("browser_signature", signatures.slice(i, i + CHUNK));
    if (error) throw error;
    for (const row of (data ?? []) as BrowserRow[]) {
      const signature = String(row.browser_signature ?? "").trim();
      if (signature) bySignature.set(signature, row);
    }
  }
  return bySignature;
}
