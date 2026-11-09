import type { BlogColumnDefinition } from "@/types/blog";
import type { FieldGroup, HappyTableConfig } from "@/lib/happySpotSchema";

// public.happy_chat_ai_config (Happy Milo site): the AI settings behind
// Happy Chat. A partial unique index allows a single is_active = true row:
// that row is the config the chat uses. Ranges in the labels mirror the
// table's check constraints.

export const HAPPY_CHAT_AI_CONFIG_TABLE = "happy_chat_ai_config";

const col = (
  name: string,
  label: string,
  uiType: BlogColumnDefinition["uiType"],
  { required = false, readOnly = false, nullable = false } = {},
): BlogColumnDefinition => ({
  name,
  label,
  uiType,
  required,
  readOnly,
  nullable,
});

const AI_CONFIG_COLUMNS: BlogColumnDefinition[] = [
  col("id", "Id", "text", { readOnly: true }),
  col("created_at", "Created", "datetime", { readOnly: true }),
  col("updated_at", "Updated", "datetime", { readOnly: true }),
  col("name", "Name (1–120 chars)", "text", { required: true }),
  col("notes", "Notes (internal)", "text"),
  col(
    "is_active",
    "Is Active (the config the chat uses; only one can be on)",
    "boolean",
  ),
  col("is_enabled", "Is Enabled", "boolean"),
  col("provider", "Provider", "text", { required: true }),
  col("model", "Model (e.g. gpt-5.5)", "text", { required: true }),
  col("reasoning_effort", "Reasoning effort", "text", { nullable: true }),
  col("text_verbosity", "Text verbosity", "text", { nullable: true }),
  col("temperature", "Temperature (0–2, empty = provider default)", "number"),
  col("max_output_tokens", "Max output tokens (100–128000)", "number", {
    required: true,
  }),
  col("timeout_ms", "Timeout in ms (5000–300000)", "number", {
    required: true,
  }),
  col("max_retries", "Max retries (0–5)", "number", { required: true }),
  col("provider_options", "Provider options (JSON object)", "json"),
  col("instructions", "Instructions (system prompt)", "markdown", {
    required: true,
  }),
  col(
    "language_instructions",
    'Per-language instructions (JSON object, e.g. {"fr": "…", "en": "…"})',
    "json",
  ),
  col("reply_format", "Reply format", "text", { required: true }),
  col("history_size", "History size (1–200 messages)", "number", {
    required: true,
  }),
  col("max_images", "Max images (0–20)", "number", { required: true }),
  col("author_name", "Author name (1–80 chars)", "text", { required: true }),
  col("author_image_url", "Author image URL (optional)", "url", {
    nullable: true,
  }),
];

const AI_CONFIG_GROUPS: FieldGroup[] = [
  {
    title: "Config",
    fields: [
      "id",
      "name",
      "notes",
      "is_active",
      "is_enabled",
      "created_at",
      "updated_at",
    ],
  },
  {
    title: "Model",
    fields: [
      "provider",
      "model",
      "reasoning_effort",
      "text_verbosity",
      "temperature",
      "max_output_tokens",
      "timeout_ms",
      "max_retries",
      "provider_options",
    ],
  },
  {
    title: "Prompt",
    fields: ["instructions", "language_instructions", "reply_format"],
  },
  { title: "Context", fields: ["history_size", "max_images"] },
  { title: "Chat author", fields: ["author_name", "author_image_url"] },
];

// A new row starts from the table's defaults, so only name and
// instructions are left to fill.
const AI_CONFIG_DEFAULTS: Record<string, unknown> = {
  is_active: false,
  is_enabled: true,
  provider: "openai",
  model: "gpt-5.5",
  max_output_tokens: 4000,
  timeout_ms: 60000,
  max_retries: 1,
  reply_format: "markdown",
  history_size: 40,
  max_images: 8,
  author_name: "Happy Milo",
};

export const HAPPY_CHAT_AI_CONFIG: HappyTableConfig = {
  table: HAPPY_CHAT_AI_CONFIG_TABLE,
  label: "Happy Chat AI config",
  columns: AI_CONFIG_COLUMNS,
  groups: AI_CONFIG_GROUPS,
  orderBy: "created_at",
  singleActiveColumn: "is_active",
  defaults: AI_CONFIG_DEFAULTS,
};

const option = (value: string, label = value) => ({ value, label });
const single = (...values: string[]) => ({
  multiple: false,
  options: values.map((value) => option(value)),
});

/** Dropdowns for the enum columns (same values as the DB checks). */
export const HAPPY_CHAT_AI_CONFIG_SELECTS = {
  provider: single("openai"),
  reasoning_effort: single("none", "minimal", "low", "medium", "high", "xhigh"),
  text_verbosity: single("low", "medium", "high"),
  reply_format: single("markdown", "text", "html"),
};
