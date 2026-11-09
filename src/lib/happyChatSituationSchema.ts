import type { BlogColumnDefinition } from "@/types/blog";
import type { FieldGroup, HappyTableConfig } from "@/lib/happySpotSchema";

// public.happy_chat_situation (Happy Milo site, migration
// 20261109160000_happy_chat_situations). One row per (translation_key,
// language): the FR and EN versions of a situation share translation_key.
// The site shows only is_active = true rows (RLS), refreshed within a
// minute. Writes need a key allowed to write the table (service role).

export const HAPPY_CHAT_SITUATION_TABLE = "happy_chat_situation";

const col = (
  name: string,
  label: string,
  uiType: BlogColumnDefinition["uiType"],
  required = false,
  readOnly = false,
): BlogColumnDefinition => ({ name, label, uiType, required, readOnly });

const SITUATION_COLUMNS: BlogColumnDefinition[] = [
  col("id", "Id", "text", false, true),
  col("created_at", "Created", "datetime", false, true),
  col("updated_at", "Updated", "datetime", false, true),
  col("is_active", "Is Active (live on the site)", "boolean"),
  col("language", "Language", "text", true),
  col("translation_key", "Translation key (same for FR + EN, e.g. difficult-day)", "text", true),
  col("slug", "Slug (localized, a-z 0-9 -)", "text", true),
  col("category", "Category label, in the row's language (e.g. Au travail / At work)", "text", true),
  col("sort_order", "Sort order (ascending)", "number", true),
  col("title", "Title (H1, the question answered)", "text", true),
  col("subtitle", "Subtitle", "text"),
  col("short_description", "Short direct answer (also card text)", "text", true),
  col("image_url", "Card / hero image URL (optional)", "url"),
  col("markdown_content", "Practical guidance (markdown, ## sections)", "markdown"),
  col("example_text", "Example (markdown)", "markdown"),
  col("starter_prompt", "Chat starter (prefilled, editable, never auto-sent)", "text", true),
  col("cta_label", "Chat button label", "text", true),
  col("seo_title", "SEO title (≤ 70 chars)", "text", true),
  col("seo_description", "SEO description (≤ 160 chars)", "text", true),
  col("faq", "FAQ", "faq"),
];

const SITUATION_GROUPS: FieldGroup[] = [
  { title: "Publication", fields: ["id", "is_active", "language", "translation_key", "slug", "category", "sort_order", "created_at", "updated_at"] },
  { title: "Page", fields: ["title", "subtitle", "short_description", "image_url", "markdown_content", "example_text"] },
  { title: "Chat entry", fields: ["starter_prompt", "cta_label"] },
  { title: "SEO", fields: ["seo_title", "seo_description"] },
  { title: "FAQ", fields: ["faq"] },
];

export const HAPPY_CHAT_SITUATION_CONFIG: HappyTableConfig = {
  table: HAPPY_CHAT_SITUATION_TABLE,
  label: "Happy Chat situations",
  columns: SITUATION_COLUMNS,
  groups: SITUATION_GROUPS,
};

const option = (value: string, label = value) => ({ value, label });

/** Dropdown for the language column (same values as the DB check). */
export const HAPPY_CHAT_SITUATION_SELECTS = {
  language: { multiple: false, options: [option("fr", "Français"), option("en", "English")] },
};
