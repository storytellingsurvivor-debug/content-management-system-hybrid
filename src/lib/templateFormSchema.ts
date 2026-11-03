import type { BlogColumnDefinition, BlogRow, FieldUiType } from "@/types/blog";

const READ_ONLY_COLUMNS = new Set(["id", "created_at"]);
const REQUIRED_COLUMNS = new Set(["slug", "language", "brand"]);

export const TEMPLATE_LANGUAGE_OPTIONS = ["en", "fr"] as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGE_OPTIONS)[number];

// Fallback when the table probe hasn't resolved yet; Happy-Milo uses
// happy_wall_audience_template, older DBs hope_wall_audience_template.
export const TEMPLATE_TABLE = "happy_wall_audience_template";

const LONG_TEXT_FIELDS = new Set([
  "hero_description",
  "how_it_works_description",
  "metadata_description",
  "hero_bubble_message",
  "markdown_content",
  "final_cta_text",
  "done_for_you_text",
  "proof_note",
]);

// --- Audience page wording + guided defaults (Happy-Milo) ------------------
// Allowed values mirror the CHECK constraints of migration
// 20261104120000_add_audience_page_content_fields (happy-milo-core). Keep
// both in sync: a value outside these lists is refused by the database.

export interface SelectOption {
  value: string;
  label: string;
}

export const AUDIENCE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "birthday", label: "Birthday" },
  { value: "creator", label: "Creator / streamer" },
  { value: "farewell", label: "Farewell / retirement" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Wedding anniversary" },
  { value: "family", label: "Family day (Mother's, Father's, name day)" },
  { value: "holiday", label: "Public holiday (14 July…)" },
  { value: "community", label: "Community event (music day…)" },
  { value: "company", label: "Company milestone" },
  { value: "thank_you", label: "Thank you" },
  { value: "congratulations", label: "Congratulations" },
  { value: "other", label: "Other" },
];

// "" = no preselection (stored as NULL).
export const GUIDED_OCCASION_OPTIONS: SelectOption[] = [
  { value: "", label: "None, the user chooses" },
  { value: "birthday", label: "Birthday" },
  { value: "farewell", label: "Farewell" },
  { value: "congratulations", label: "Congratulations" },
  { value: "wedding", label: "Wedding / anniversary" },
  { value: "thank_you", label: "Thank you" },
  { value: "just_because", label: "Just because" },
  { value: "community", label: "Creator / community milestone" },
  { value: "other", label: "Other" },
];

export const GUIDED_SUBJECT_TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "None, the user chooses" },
  { value: "person", label: "Person" },
  { value: "creator_channel", label: "Creator / channel" },
  { value: "company", label: "Company" },
  { value: "association_community", label: "Association / community" },
  { value: "team", label: "Team" },
  { value: "other", label: "Other" },
];

export const TEMPLATE_SELECT_OPTIONS: Record<string, SelectOption[]> = {
  category: AUDIENCE_CATEGORY_OPTIONS,
  guided_occasion: GUIDED_OCCASION_OPTIONS,
  guided_subject_type: GUIDED_SUBJECT_TYPE_OPTIONS,
};

/** Short explanations shown under the audience fields in the editor. */
export const TEMPLATE_FIELD_HELP: Record<string, string> = {
  category:
    "Page family. Shows the Twitch/Slack integrations for creator and farewell pages, and the \"celebration\" wording for holiday and community pages.",
  guided_occasion: "Preselected in /happy-wall/create when people click the page's button.",
  guided_subject_type: "Preselected \"who is it for\". Leave None when it can be anyone (e.g. 14 July).",
  cta_label: "Hero button and final button. Empty: \"Create the Happy Wall\".",
  final_cta_title: "Last section title. Empty: generic title.",
  final_cta_text: "Last section text. Empty: generic text.",
  done_for_you_title: "Title of the \"I'd like some help\" block. Empty: generic.",
  done_for_you_text: "Text of the \"I'd like some help\" block. Empty: generic.",
  proof_title: "Heading above the video reactions. Empty: \"Happy Wall, for real\".",
  proof_note:
    "Line under that heading. Empty: no line. Use it when the videos come from other celebrations.",
  use_cases_title: "Title of the \"who it's for\" block.",
  use_cases: "One per line (e.g. \"With your family\"). Empty list: block hidden.",
};

const NULLABLE_SELECTS = new Set(["guided_occasion", "guided_subject_type"]);
const LINE_LIST_FIELDS = new Set(["use_cases"]);

/**
 * Editor values -> what the database accepts for the audience fields:
 * "" selects become NULL (CHECK constraints), category falls back to
 * "other", and the use-case list goes back to a JSON array (one per line,
 * commas allowed inside an item).
 */
export function normalizeTemplatePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  for (const name of NULLABLE_SELECTS) {
    if (name in next && (next[name] === "" || next[name] === undefined)) {
      next[name] = null;
    }
  }
  if ("category" in next && !String(next.category ?? "").trim()) {
    next.category = "other";
  }
  for (const name of LINE_LIST_FIELDS) {
    if (!(name in next)) continue;
    const raw = next[name];
    const lines = Array.isArray(raw)
      ? raw.map((item) => String(item))
      : String(raw ?? "").split("\n");
    next[name] = lines.map((line) => line.trim()).filter(Boolean);
  }
  return next;
}

const TEMPLATE_OVERRIDES: Record<
  string,
  Partial<Pick<BlogColumnDefinition, "uiType" | "required" | "readOnly">>
> = {
  id: { readOnly: true },
  created_at: { uiType: "datetime", readOnly: true },
  is_active: { uiType: "boolean", required: false },
  uploaded_image_url: { uiType: "url" },
  markdown_content: { uiType: "markdown" },
  faq: { uiType: "faq" },
  category: { uiType: "select" },
  guided_occasion: { uiType: "select" },
  guided_subject_type: { uiType: "select" },
  use_cases: { uiType: "stringArray" },
  slug: { required: true },
  language: { required: true },
  brand: { required: true },
};

export const DEFAULT_TEMPLATE_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  {
    name: "created_at",
    label: "Created Date",
    uiType: "datetime",
    required: false,
    readOnly: true,
  },
  {
    name: "brand",
    label: "Brand",
    uiType: "text",
    required: true,
    readOnly: false,
  },
  {
    name: "slug",
    label: "Slug",
    uiType: "text",
    required: true,
    readOnly: false,
  },
  {
    name: "language",
    label: "Language",
    uiType: "text",
    required: true,
    readOnly: false,
  },
  {
    name: "is_active",
    label: "Is Active",
    uiType: "boolean",
    required: false,
    readOnly: false,
  },
  {
    name: "hero_title",
    label: "Hero Title",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "hero_subtitle",
    label: "Hero Subtitle",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "hero_description",
    label: "Hero Description",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "hero_bubble_message",
    label: "Hero Bubble Message",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "uploaded_image_url",
    label: "Uploaded Image URL",
    uiType: "url",
    required: false,
    readOnly: false,
  },
  {
    name: "how_it_works_title",
    label: "How It Works Title",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "how_it_works_description",
    label: "How It Works Description",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "examples_section_title",
    label: "Examples Section Title",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "metadata_title",
    label: "Metadata Title",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "metadata_description",
    label: "Metadata Description",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "markdown_content",
    label: "Markdown Content",
    uiType: "markdown",
    required: false,
    readOnly: false,
  },
  {
    name: "faq",
    label: "FAQ",
    uiType: "faq",
    required: false,
    readOnly: false,
  },
  { name: "category", label: "Category", uiType: "select", required: false, readOnly: false },
  { name: "guided_occasion", label: "Guided Occasion", uiType: "select", required: false, readOnly: false },
  { name: "guided_subject_type", label: "Guided Subject Type", uiType: "select", required: false, readOnly: false },
  { name: "cta_label", label: "CTA Label", uiType: "text", required: false, readOnly: false },
  { name: "final_cta_title", label: "Final CTA Title", uiType: "text", required: false, readOnly: false },
  { name: "final_cta_text", label: "Final CTA Text", uiType: "text", required: false, readOnly: false },
  { name: "done_for_you_title", label: "Done For You Title", uiType: "text", required: false, readOnly: false },
  { name: "done_for_you_text", label: "Done For You Text", uiType: "text", required: false, readOnly: false },
  { name: "proof_title", label: "Proof Title", uiType: "text", required: false, readOnly: false },
  { name: "proof_note", label: "Proof Note", uiType: "text", required: false, readOnly: false },
  { name: "use_cases_title", label: "Use Cases Title", uiType: "text", required: false, readOnly: false },
  { name: "use_cases", label: "Use Cases", uiType: "stringArray", required: false, readOnly: false },
];

export function isLongTextField(name: string): boolean {
  return LONG_TEXT_FIELDS.has(name);
}

function guessUiType(name: string, value: unknown): FieldUiType {
  if (name.endsWith("_url") || name.includes("url")) return "url";
  if (name.endsWith("_at") || name.includes("date")) return "datetime";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}

function toLabel(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function inferTemplateColumns(
  row: BlogRow | null,
): BlogColumnDefinition[] {
  if (!row) return DEFAULT_TEMPLATE_COLUMNS;

  const ordered: BlogColumnDefinition[] = [];
  const seen = new Set<string>();

  // Known columns first (default order), but only those the table really has —
  // e.g. Happy-Milo dropped the brand column entirely.
  for (const column of DEFAULT_TEMPLATE_COLUMNS) {
    if (!(column.name in row)) continue;
    ordered.push(column);
    seen.add(column.name);
  }

  for (const [name, value] of Object.entries(row)) {
    if (seen.has(name)) continue;
    const override = TEMPLATE_OVERRIDES[name];
    ordered.push({
      name,
      label: toLabel(name),
      uiType: override?.uiType ?? guessUiType(name, value),
      required: override?.required ?? REQUIRED_COLUMNS.has(name),
      readOnly: override?.readOnly ?? READ_ONLY_COLUMNS.has(name),
    });
    seen.add(name);
  }

  return ordered;
}

export function validateTemplatePayload(
  payload: Record<string, unknown>,
): string | null {
  const slug = String(payload.slug ?? "").trim();
  const language = String(payload.language ?? "").trim();

  if (!slug) return "Slug is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug format is invalid. Use lowercase letters, numbers, and hyphens.";
  }
  if (!language) return "Language is required.";
  if (!TEMPLATE_LANGUAGE_OPTIONS.includes(language as TemplateLanguage)) {
    return `Language must be one of: ${TEMPLATE_LANGUAGE_OPTIONS.join(", ")}.`;
  }
  // brand only exists on multi-brand DBs; require it only when the column is there.
  if ("brand" in payload && !String(payload.brand ?? "").trim()) {
    return "Brand is required.";
  }

  const allowed = (options: SelectOption[]) =>
    new Set(options.map((option) => option.value).filter(Boolean));
  if ("category" in payload && !allowed(AUDIENCE_CATEGORY_OPTIONS).has(String(payload.category))) {
    return `Category must be one of: ${[...allowed(AUDIENCE_CATEGORY_OPTIONS)].join(", ")}.`;
  }
  for (const [name, options] of [
    ["guided_occasion", GUIDED_OCCASION_OPTIONS],
    ["guided_subject_type", GUIDED_SUBJECT_TYPE_OPTIONS],
  ] as const) {
    const value = payload[name];
    if (value !== null && value !== undefined && !allowed(options).has(String(value))) {
      return `${name} must be empty or one of: ${[...allowed(options)].join(", ")}.`;
    }
  }
  if ("use_cases" in payload && !Array.isArray(payload.use_cases)) {
    return "Use Cases must be a list.";
  }

  const url = payload.uploaded_image_url;
  if (typeof url === "string" && url.trim().length > 0) {
    try {
      new URL(url);
    } catch {
      return "Uploaded Image URL must be a valid URL.";
    }
  }

  return null;
}

export function findDuplicateTemplate(
  rows: BlogRow[],
  payload: Record<string, unknown>,
  excludeId?: unknown,
): BlogRow | null {
  const brand = String(payload.brand ?? "").trim();
  const slug = String(payload.slug ?? "").trim();
  const language = String(payload.language ?? "").trim();
  if (!slug || !language) return null;

  const excludeKey = excludeId === undefined ? "" : String(excludeId);

  return (
    rows.find((row) => {
      const rowId = String(row.id ?? "");
      if (excludeKey && rowId === excludeKey) return false;
      // brand is only discriminating on multi-brand DBs.
      if (brand && String(row.brand ?? "").trim() !== brand) return false;
      return (
        String(row.slug ?? "").trim() === slug &&
        String(row.language ?? "").trim() === language
      );
    }) ?? null
  );
}
