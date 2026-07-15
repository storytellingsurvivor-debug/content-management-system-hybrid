import type { BlogColumnDefinition } from "@/types/blog";
import type { FieldGroup, HappyTableConfig } from "@/lib/happySpotSchema";

export const HAPPY_DATE_TABLE = "happy_date";
export const HAPPY_DATE_CATEGORY_TABLE = "happy_date_category";

const DATE_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "created_at", label: "Created Date", uiType: "datetime", required: false, readOnly: false },
  { name: "slug", label: "Slug", uiType: "text", required: true, readOnly: false },
  { name: "language", label: "Language", uiType: "text", required: true, readOnly: false },
  { name: "name", label: "Name", uiType: "text", required: true, readOnly: false },
  { name: "kind", label: "Kind", uiType: "text", required: true, readOnly: false },
  { name: "is_active", label: "Is Active", uiType: "boolean", required: false, readOnly: false },
  { name: "category_id", label: "Category", uiType: "number", required: false, readOnly: false },
  { name: "event_month", label: "Event Month", uiType: "number", required: false, readOnly: false },
  { name: "event_day", label: "Event Day", uiType: "number", required: false, readOnly: false },
  { name: "event_rule", label: "Event Rule", uiType: "text", required: false, readOnly: false },
  { name: "emoji", label: "Emoji", uiType: "text", required: false, readOnly: false },
  { name: "color", label: "Color", uiType: "text", required: false, readOnly: false },
  { name: "title", label: "Title", uiType: "text", required: false, readOnly: false },
  { name: "intro", label: "Intro", uiType: "text", required: false, readOnly: false },
  { name: "position", label: "Position", uiType: "number", required: true, readOnly: false },
  { name: "views", label: "Views", uiType: "number", required: false, readOnly: true },
  { name: "structured_data", label: "Structured Data (JSON)", uiType: "json", required: false, readOnly: false },
  { name: "markdown_content", label: "Markdown Content", uiType: "markdown", required: false, readOnly: false },
  { name: "metadata_title", label: "Metadata Title", uiType: "text", required: false, readOnly: false },
  { name: "metadata_description", label: "Metadata Description", uiType: "text", required: false, readOnly: false },
  { name: "metadata_keywords", label: "Metadata Keywords", uiType: "text", required: false, readOnly: false },
  { name: "article_blog_slugs", label: "Article Blog Slugs", uiType: "stringArray", required: false, readOnly: false },
];

const CATEGORY_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "created_at", label: "Created Date", uiType: "datetime", required: false, readOnly: false },
  { name: "slug", label: "Slug", uiType: "text", required: true, readOnly: false },
  { name: "language", label: "Language", uiType: "text", required: true, readOnly: false },
  { name: "label", label: "Label", uiType: "text", required: true, readOnly: false },
  { name: "is_active", label: "Is Active", uiType: "boolean", required: false, readOnly: false },
  { name: "emoji", label: "Emoji", uiType: "text", required: false, readOnly: false },
  { name: "color", label: "Color", uiType: "text", required: false, readOnly: false },
  { name: "title", label: "Title", uiType: "text", required: false, readOnly: false },
  { name: "description", label: "Description", uiType: "text", required: false, readOnly: false },
  { name: "position", label: "Position", uiType: "number", required: true, readOnly: false },
  { name: "markdown_content", label: "Markdown Content", uiType: "markdown", required: false, readOnly: false },
  { name: "metadata_title", label: "Metadata Title", uiType: "text", required: false, readOnly: false },
  { name: "metadata_description", label: "Metadata Description", uiType: "text", required: false, readOnly: false },
  { name: "metadata_keywords", label: "Metadata Keywords", uiType: "text", required: false, readOnly: false },
  { name: "article_blog_slugs", label: "Article Blog Slugs", uiType: "stringArray", required: false, readOnly: false },
];

const DATE_GROUPS: FieldGroup[] = [
  { title: "Identity", fields: ["id", "created_at", "slug", "language", "name", "kind", "is_active"] },
  { title: "Category", fields: ["category_id"] },
  { title: "Event", fields: ["event_month", "event_day", "event_rule"] },
  { title: "Appearance", fields: ["emoji", "color", "title", "intro"] },
  { title: "Content", fields: ["position", "views", "markdown_content", "structured_data"] },
  { title: "Metadata", fields: ["metadata_title", "metadata_description", "metadata_keywords", "article_blog_slugs"] },
];

const CATEGORY_GROUPS: FieldGroup[] = [
  { title: "Identity", fields: ["id", "created_at", "slug", "language", "label", "is_active"] },
  { title: "Appearance", fields: ["emoji", "color", "title", "description", "position"] },
  { title: "Metadata", fields: ["metadata_title", "metadata_description", "metadata_keywords", "markdown_content", "article_blog_slugs"] },
];

export const HAPPY_DATE_TABLES: Record<"dates" | "categories", HappyTableConfig> = {
  dates: { table: HAPPY_DATE_TABLE, label: "Dates", columns: DATE_COLUMNS, groups: DATE_GROUPS },
  categories: { table: HAPPY_DATE_CATEGORY_TABLE, label: "Categories", columns: CATEGORY_COLUMNS, groups: CATEGORY_GROUPS },
};
