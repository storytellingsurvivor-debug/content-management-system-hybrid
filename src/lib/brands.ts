import type { SupabaseClient } from "@supabase/supabase-js";

export type BrandKey = "happy" | "forever" | "support" | "other";

export interface BrandPreset {
  key: BrandKey;
  label: string;
  url: string;
}

export const BRAND_PRESETS: BrandPreset[] = [
  {
    key: "happy",
    label: "Happy Milo",
    url: "https://sffejjhgtqzrdhudminu.supabase.co",
  },
  {
    key: "forever",
    label: "Forever Milo",
    url: "https://hhztnlxperhjpmvbjjhb.supabase.co",
  },
  {
    key: "support",
    label: "Support Milo",
    url: "https://fyzzkcjuwqypafzifhck.supabase.co",
  },
  { key: "other", label: "Autre", url: "" },
];

// Happy-Milo renamed hope_wall_* -> happy_wall_*; older DBs keep the old names.
const TEMPLATE_TABLE_CANDIDATES = [
  "happy_wall_audience_template",
  "hope_wall_audience_template",
];
const WALL_TABLE_CANDIDATES = ["happy_wall", "hope_wall"];

export interface WorkspaceFeatures {
  templateTable: string | null;
  wallTable: string | null;
  hasSpots: boolean;
  hasDates: boolean;
}

async function tableExists(
  client: SupabaseClient,
  table: string,
): Promise<boolean> {
  const { error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .limit(1);
  return !error;
}

async function firstExistingTable(
  client: SupabaseClient,
  candidates: string[],
): Promise<string | null> {
  for (const table of candidates) {
    if (await tableExists(client, table)) return table;
  }
  return null;
}

// Probes each feature table so the UI only shows tabs the connected DB supports.
export async function detectWorkspaceFeatures(
  client: SupabaseClient,
): Promise<WorkspaceFeatures> {
  const [templateTable, wallTable, hasSpots, hasDates] = await Promise.all([
    firstExistingTable(client, TEMPLATE_TABLE_CANDIDATES),
    firstExistingTable(client, WALL_TABLE_CANDIDATES),
    tableExists(client, "happy_spot"),
    tableExists(client, "happy_date"),
  ]);
  return { templateTable, wallTable, hasSpots, hasDates };
}
