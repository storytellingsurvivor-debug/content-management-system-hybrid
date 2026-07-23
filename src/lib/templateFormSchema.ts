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
]);

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
