import type { BlogColumnDefinition, BlogRow, FieldUiType } from "@/types/blog";

const READ_ONLY_COLUMNS = new Set(["id", "created_at", "updated_at"]);

const BLOG_OVERRIDES: Record<
  string,
  Partial<Pick<BlogColumnDefinition, "uiType" | "required" | "readOnly">>
> = {
  content: { uiType: "markdown", required: true },
  cover_url: { uiType: "url" },
  author_url: { uiType: "url" },
  read_in_minutes: { uiType: "number" },
  created_at: { uiType: "datetime", readOnly: true },
};

export const DEFAULT_BLOG_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  {
    name: "created_at",
    label: "Created Date",
    uiType: "datetime",
    required: false,
    readOnly: true,
  },
  {
    name: "slug",
    label: "Slug",
    uiType: "text",
    required: true,
    readOnly: false,
  },
  {
    name: "category",
    label: "Category",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "content",
    label: "Content (Markdown)",
    uiType: "markdown",
    required: true,
    readOnly: false,
  },
  {
    name: "author_name",
    label: "Author Name",
    uiType: "text",
    required: false,
    readOnly: false,
  },
  {
    name: "author_url",
    label: "Author URL",
    uiType: "url",
    required: false,
    readOnly: false,
  },
  {
    name: "cover_url",
    label: "Cover URL",
    uiType: "url",
    required: false,
    readOnly: false,
  },
  {
    name: "read_in_minutes",
    label: "Read In Minutes",
    uiType: "number",
    required: false,
    readOnly: false,
  },
];

function guessUiType(name: string, value: unknown): FieldUiType {
  if (name === "content") return "markdown";
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

export function inferColumnsFromRow(
  row: BlogRow | null,
): BlogColumnDefinition[] {
  if (!row) {
    return DEFAULT_BLOG_COLUMNS;
  }

  const inferred = Object.entries(row).map(([name, value]) => {
    const override = BLOG_OVERRIDES[name];
    return {
      name,
      label: toLabel(name),
      uiType: override?.uiType ?? guessUiType(name, value),
      required: override?.required ?? (name === "slug" || name === "content"),
      readOnly: override?.readOnly ?? READ_ONLY_COLUMNS.has(name),
    } satisfies BlogColumnDefinition;
  });

  if (inferred.length === 0) {
    return DEFAULT_BLOG_COLUMNS;
  }

  return inferred;
}

export function toWritablePayload(
  values: BlogRow,
  columns: BlogColumnDefinition[],
): Record<string, unknown> {
  const writableNames = new Set(
    columns.filter((column) => !column.readOnly).map((column) => column.name),
  );

  return Object.entries(values).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (!writableNames.has(key)) return acc;
      if (typeof value === "string") {
        const trimmed = value.trim();
        acc[key] = trimmed;
        return acc;
      }
      acc[key] = value;
      return acc;
    },
    {},
  );
}

export function validateBlogPayload(
  payload: Record<string, unknown>,
): string | null {
  const slug = String(payload.slug ?? "").trim();
  const content = String(payload.content ?? "").trim();

  if (!slug) return "Slug is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug format is invalid. Use lowercase letters, numbers, and hyphens.";
  }
  if (!content) return "Content is required.";

  const minutes = payload.read_in_minutes;
  if (
    minutes !== undefined &&
    minutes !== null &&
    String(minutes).trim() !== ""
  ) {
    const asNumber = Number(minutes);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      return "Read In Minutes must be a positive number.";
    }
  }

  for (const key of ["author_url", "cover_url"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      try {
        new URL(value);
      } catch {
        return `${toLabel(key)} must be a valid URL.`;
      }
    }
  }

  return null;
}
