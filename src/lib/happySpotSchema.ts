import type { BlogColumnDefinition, BlogRow } from "@/types/blog";

export const HAPPY_SPOT_TABLE = "happy_spot";
export const HAPPY_SPOT_TAG_TABLE = "happy_spot_tag";
export const HAPPY_SPOT_TAG_CONTENT_TABLE = "happy_spot_tag_content";

export interface FieldGroup {
  title: string;
  fields: string[];
}

const SPOT_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "created_at", label: "Created Date", uiType: "datetime", required: false, readOnly: true },
  { name: "slug", label: "Slug", uiType: "text", required: true, readOnly: false },
  { name: "language", label: "Language", uiType: "text", required: true, readOnly: false },
  { name: "name", label: "Name", uiType: "text", required: true, readOnly: false },
  { name: "is_active", label: "Is Active", uiType: "boolean", required: false, readOnly: false },
  { name: "address", label: "Address", uiType: "text", required: false, readOnly: false },
  { name: "city", label: "City", uiType: "text", required: false, readOnly: false },
  { name: "lat", label: "Latitude", uiType: "number", required: true, readOnly: false },
  { name: "lng", label: "Longitude", uiType: "number", required: true, readOnly: false },
  { name: "main_tag_id", label: "Main Tag Id", uiType: "number", required: false, readOnly: false },
  { name: "tag_ids", label: "Tag Ids", uiType: "numberArray", required: false, readOnly: false },
  { name: "image_url", label: "Image URL", uiType: "url", required: false, readOnly: false },
  { name: "note", label: "Note", uiType: "text", required: false, readOnly: false },
  { name: "author", label: "Author", uiType: "text", required: true, readOnly: false },
  { name: "author_image", label: "Author Image URL", uiType: "url", required: false, readOnly: false },
  { name: "views", label: "Views", uiType: "number", required: false, readOnly: true },
  { name: "structured_data", label: "Structured Data (JSON)", uiType: "json", required: false, readOnly: false },
  // Legacy: page content is tag-led now, edit it under "Spot content per tag".
  // Read-only rather than removed so the pre-migration copy stays visible for
  // spots with no main tag, which got no row in the backfill.
  { name: "markdown_content", label: "Markdown Content (legacy, not displayed)", uiType: "markdown", required: false, readOnly: true },
  { name: "metadata_title", label: "Metadata Title", uiType: "text", required: false, readOnly: false },
  { name: "metadata_description", label: "Metadata Description", uiType: "text", required: false, readOnly: false },
  { name: "metadata_keywords", label: "Metadata Keywords", uiType: "text", required: false, readOnly: false },
  { name: "article_blog_slugs", label: "Article Blog Slugs", uiType: "stringArray", required: false, readOnly: false },
  { name: "browser_signature", label: "Browser Signature", uiType: "text", required: false, readOnly: false },
];

const TAG_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "created_at", label: "Created Date", uiType: "datetime", required: false, readOnly: true },
  { name: "slug", label: "Slug", uiType: "text", required: true, readOnly: false },
  { name: "language", label: "Language", uiType: "text", required: true, readOnly: false },
  { name: "type", label: "Type", uiType: "text", required: true, readOnly: false },
  { name: "label", label: "Label", uiType: "text", required: true, readOnly: false },
  { name: "is_main", label: "Is Main", uiType: "boolean", required: false, readOnly: false },
  { name: "is_active", label: "Is Active", uiType: "boolean", required: false, readOnly: false },
  { name: "can_add_spot", label: "Can Add Spot", uiType: "boolean", required: false, readOnly: false },
  { name: "color", label: "Color", uiType: "text", required: false, readOnly: false },
  { name: "emoji", label: "Emoji", uiType: "text", required: false, readOnly: false },
  { name: "image_url", label: "Image URL", uiType: "url", required: false, readOnly: false },
  { name: "title", label: "Title", uiType: "text", required: false, readOnly: false },
  { name: "description", label: "Description", uiType: "text", required: false, readOnly: false },
  { name: "position", label: "Position", uiType: "number", required: true, readOnly: false },
  { name: "max_zoom", label: "Max Zoom", uiType: "number", required: false, readOnly: false },
  { name: "center_lat", label: "Center Latitude", uiType: "number", required: false, readOnly: false },
  { name: "center_lng", label: "Center Longitude", uiType: "number", required: false, readOnly: false },
  { name: "metadata_title", label: "Metadata Title", uiType: "text", required: false, readOnly: false },
  { name: "metadata_description", label: "Metadata Description", uiType: "text", required: false, readOnly: false },
  { name: "metadata_keywords", label: "Metadata Keywords", uiType: "text", required: false, readOnly: false },
  { name: "markdown_content", label: "Markdown Content", uiType: "markdown", required: false, readOnly: false },
  { name: "article_blog_slugs", label: "Article Blog Slugs", uiType: "stringArray", required: false, readOnly: false },
];

// Per-tag content variant of a spot. Only for tags OTHER than the spot's main
// tag: the main tag's content is the spot's own columns.
const SPOT_TAG_CONTENT_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "created_at", label: "Created Date", uiType: "datetime", required: false, readOnly: true },
  { name: "spot_id", label: "Spot Id", uiType: "number", required: true, readOnly: false },
  { name: "tag_id", label: "Tag Id", uiType: "number", required: true, readOnly: false },
  { name: "is_active", label: "Is Active", uiType: "boolean", required: false, readOnly: false },
  { name: "position", label: "Position", uiType: "number", required: false, readOnly: false },
  { name: "title", label: "Title", uiType: "text", required: false, readOnly: false },
  { name: "image_url", label: "Image URL", uiType: "url", required: false, readOnly: false },
  { name: "note", label: "Note", uiType: "text", required: false, readOnly: false },
  { name: "markdown_content", label: "Markdown Content", uiType: "markdown", required: false, readOnly: false },
];

const SPOT_GROUPS: FieldGroup[] = [
  { title: "Identity", fields: ["id", "created_at", "slug", "language", "name", "is_active"] },
  { title: "Location", fields: ["address", "city", "lat", "lng"] },
  { title: "Tags", fields: ["main_tag_id", "tag_ids"] },
  { title: "Content", fields: ["image_url", "note", "author", "author_image", "views", "markdown_content", "structured_data"] },
  { title: "Metadata", fields: ["metadata_title", "metadata_description", "metadata_keywords", "article_blog_slugs", "browser_signature"] },
];

const TAG_GROUPS: FieldGroup[] = [
  { title: "Identity", fields: ["id", "created_at", "slug", "language", "type", "label"] },
  { title: "Flags", fields: ["is_main", "is_active", "can_add_spot"] },
  { title: "Appearance", fields: ["color", "emoji", "image_url", "title", "description"] },
  { title: "Map", fields: ["position", "max_zoom", "center_lat", "center_lng"] },
  { title: "Metadata", fields: ["metadata_title", "metadata_description", "metadata_keywords", "markdown_content", "article_blog_slugs"] },
];

const SPOT_TAG_CONTENT_GROUPS: FieldGroup[] = [
  { title: "Link", fields: ["id", "created_at", "spot_id", "tag_id", "is_active", "position"] },
  { title: "Content", fields: ["title", "image_url", "note", "markdown_content"] },
];

export interface HappyTableConfig {
  table: string;
  label: string;
  columns: BlogColumnDefinition[];
  groups: FieldGroup[];
}

export const HAPPY_TABLES: Record<
  "spots" | "tags" | "tagContents",
  HappyTableConfig
> = {
  spots: { table: HAPPY_SPOT_TABLE, label: "Spots", columns: SPOT_COLUMNS, groups: SPOT_GROUPS },
  tags: { table: HAPPY_SPOT_TAG_TABLE, label: "Tags", columns: TAG_COLUMNS, groups: TAG_GROUPS },
  tagContents: {
    table: HAPPY_SPOT_TAG_CONTENT_TABLE,
    label: "Tag content",
    columns: SPOT_TAG_CONTENT_COLUMNS,
    groups: SPOT_TAG_CONTENT_GROUPS,
  },
};

const MULTILINE_UI_TYPES = new Set(["markdown", "json", "stringArray", "numberArray"]);
const MULTILINE_NAMES = new Set(["note", "description", "intro", "metadata_description"]);

export function isMultilineField(column: BlogColumnDefinition): boolean {
  return MULTILINE_UI_TYPES.has(column.uiType) || MULTILINE_NAMES.has(column.name);
}

export function fieldHelperText(column: BlogColumnDefinition): string {
  if (column.uiType === "numberArray") return "One number per line";
  if (column.uiType === "stringArray") return "One value per line";
  if (column.uiType === "json") return "Valid JSON object, e.g. {}";
  return "";
}

// DB row -> editable form values (arrays/json become strings for the text inputs).
export function rowToForm(
  row: BlogRow | null,
  columns: BlogColumnDefinition[],
): BlogRow {
  const form: BlogRow = {};
  for (const column of columns) {
    const value = row ? row[column.name] : undefined;
    if (column.uiType === "boolean") {
      form[column.name] = Boolean(value);
    } else if (column.uiType === "numberArray" || column.uiType === "stringArray") {
      form[column.name] = Array.isArray(value) ? value.join("\n") : "";
    } else if (column.uiType === "json") {
      form[column.name] =
        value && typeof value === "object" ? JSON.stringify(value, null, 2) : "";
    } else if (
      column.uiType === "datetime" &&
      !column.readOnly &&
      (value === null || value === undefined)
    ) {
      // Editable datetime fields (e.g. created_at) default to now on create.
      form[column.name] = new Date().toISOString();
    } else if (value === null || value === undefined) {
      form[column.name] = "";
    } else {
      form[column.name] = value as never;
    }
  }
  return form;
}

// Arrays edited one item per line (newline or comma tolerated).
function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ponytail: arrays edited as a one-per-line list, JSON as a raw textarea — swap for
// chip/JSON-editor widgets only if content teams find the text format error-prone.
// Editable form values -> Supabase payload. Throws a readable Error on bad JSON/number input.
export function toHappyPayload(
  values: BlogRow,
  columns: BlogColumnDefinition[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.readOnly) continue;
    const raw = values[column.name];

    if (column.uiType === "boolean") {
      payload[column.name] = Boolean(raw);
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);

    if (column.uiType === "number") {
      if (text === "") {
        payload[column.name] = column.required ? "" : null;
      } else {
        const n = Number(text);
        if (!Number.isFinite(n)) throw new Error(`${column.label} must be a number.`);
        payload[column.name] = n;
      }
      continue;
    }

    if (column.uiType === "numberArray") {
      payload[column.name] = splitList(text).map((p) => {
        const n = Number(p);
        if (!Number.isFinite(n)) throw new Error(`${column.label} must be a list of numbers.`);
        return n;
      });
      continue;
    }

    if (column.uiType === "stringArray") {
      payload[column.name] = splitList(text);
      continue;
    }

    if (column.uiType === "json") {
      if (text === "") {
        payload[column.name] = {};
      } else {
        try {
          payload[column.name] = JSON.parse(text);
        } catch {
          throw new Error(`${column.label} must be valid JSON.`);
        }
      }
      continue;
    }

    payload[column.name] = text;
  }
  return payload;
}

export function validateHappyPayload(
  payload: Record<string, unknown>,
  columns: BlogColumnDefinition[],
): string | null {
  for (const column of columns) {
    if (!column.required || column.readOnly) continue;
    const value = payload[column.name];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");
    if (empty) return `${column.label} is required.`;
  }

  const slug = String(payload.slug ?? "").trim();
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug format is invalid. Use lowercase letters, numbers, and hyphens.";
  }

  for (const column of columns) {
    if (column.uiType !== "url") continue;
    const value = payload[column.name];
    if (typeof value === "string" && value.trim().length > 0) {
      try {
        new URL(value);
      } catch {
        return `${column.label} must be a valid URL.`;
      }
    }
  }

  return null;
}
