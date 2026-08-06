import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow, FieldUiType } from "@/types/blog";

// The Happy Wall is a live message wall: each wall row carries its identity,
// background artwork (mobile + desktop), the bubbles choreography, and the
// audience-submitted messages that scroll across it. Column names differ
// slightly between the current Happy-Milo schema (happy_wall_*) and older DBs
// (hope_wall_*), so everything here is discovered from the connected database
// at runtime rather than hard-coded — the same approach the blog editor uses.

// ---------------------------------------------------------------------------
// Generic column inference
// ---------------------------------------------------------------------------

const READ_ONLY_NAMES = new Set(["id", "created_at", "updated_at", "inserted_at"]);

// Names that clearly hold an image URL (background art, avatars, covers…).
const IMAGE_NAME = /(background|bg|image|img|photo|picture|cover|banner|avatar|logo|thumbnail|wallpaper)/i;
// "image"-named columns that describe how an image is laid out rather than
// where it lives: geometry (card_image_height, card_image_position_x…) and
// CSS-ish styling (image_fit, image_align…). These hold numbers or short
// keywords, never a link, so they must not be typed as a URL or the editor
// would reject them on save ("… must be a valid URL.") and the preview would
// try to render them as image thumbnails.
const IMAGE_ATTRIBUTE_NAME =
  /(height|width|size|scale|zoom|position|offset|coord|rotation|rotate|angle|skew|opacity|alpha|blur|radius|ratio|aspect|align|anchor|gravity|repeat|fit|mode|tint|margin|padding|spacing|border|duration|delay|speed|order|weight|level|priority|_x$|_y$|top$|left$|right$|bottom$)/i;
// The subset of image-attribute names that specifically hold a numeric value,
// used to type them as a number even when the current row's value is null.
const IMAGE_DIMENSION_NAME =
  /(height|width|size|scale|zoom|position|offset|rotation|angle|opacity|alpha|blur|radius|ratio|duration|delay|speed|_x$|_y$|top$|left$|right$|bottom$)/i;
// The subset of image names that specifically mean "wall background artwork".
const BACKGROUND_NAME = /(background|bg|cover|banner|wallpaper)/i;
const MOBILE_HINT = /(mobile|phone|portrait|small|_xs|_sm)/i;
const DESKTOP_HINT = /(desktop|wide|landscape|large|_lg|_xl|pc|web)/i;

function toLabel(name: string): string {
  return name
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ")
    .trim();
}

function guessUiType(name: string, value: unknown): FieldUiType {
  const n = name.toLowerCase();
  if (n.includes("choreography") || n.endsWith("_json")) return "json";
  // A URL-ish name only means a link when it isn't really an image *attribute*
  // (card_image_height, card_image_position_x, image_fit…): those describe the
  // image, they don't point at one.
  const looksLikeUrlName =
    IMAGE_NAME.test(n) || n.endsWith("_url") || n.includes("url");
  if (looksLikeUrlName && !IMAGE_ATTRIBUTE_NAME.test(n)) return "url";
  if (n.endsWith("_at") || n.includes("date")) return "datetime";
  if (typeof value === "boolean" || n.startsWith("is_") || n.startsWith("has_")) {
    return "boolean";
  }
  if (typeof value === "number") return "number";
  // No value to infer from, but the name reads as a dimension/coordinate.
  if (value == null && IMAGE_DIMENSION_NAME.test(n)) return "number";
  if (value !== null && typeof value === "object") return "json";
  return "text";
}

// Free-text columns that read better as a textarea in the editor.
const MULTILINE_MESSAGE_NAMES = new Set([
  "message",
  "content",
  "body",
  "text",
  "title_or_description",
  "description",
]);

function inferColumns(
  row: BlogRow | null,
  overrides: Record<string, Partial<BlogColumnDefinition>> = {},
  fallback: BlogColumnDefinition[] = [],
): BlogColumnDefinition[] {
  if (!row || Object.keys(row).length === 0) return fallback;
  return Object.entries(row).map(([name, value]) => {
    const override = overrides[name] ?? {};
    return {
      name,
      label: override.label ?? toLabel(name),
      uiType: override.uiType ?? guessUiType(name, value),
      required: override.required ?? false,
      readOnly: override.readOnly ?? READ_ONLY_NAMES.has(name),
    } satisfies BlogColumnDefinition;
  });
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

// Sensible defaults so a brand-new (empty) wall table can still be created from.
export const WALL_FALLBACK_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "slug", label: "Slug", uiType: "text", required: false, readOnly: false },
  {
    name: "title_or_description",
    label: "Title Or Description",
    uiType: "text",
    required: false,
    readOnly: false,
  },
];

const WALL_OVERRIDES: Record<string, Partial<BlogColumnDefinition>> = {
  slug: { required: false },
  // Edited from the dedicated "Bubbles choreography" tab — kept read-only here
  // so saving a wall's other fields never clobbers its animation.
  bubbles_choreography: { uiType: "json", readOnly: true },
  animation_duration: { uiType: "number" },
  title_or_description: { uiType: "text" },
};

export function inferWallColumns(row: BlogRow | null): BlogColumnDefinition[] {
  return inferColumns(row, WALL_OVERRIDES, WALL_FALLBACK_COLUMNS);
}

export interface BackgroundFields {
  mobile: string | null;
  desktop: string | null;
  // A single background column used for both when no mobile/desktop split exists.
  generic: string | null;
  all: string[];
}

// Figures out which columns hold the wall's background artwork, and whether the
// schema splits it into mobile / desktop variants.
export function detectBackgroundFields(
  columns: BlogColumnDefinition[],
): BackgroundFields {
  const backgroundCols = columns.filter(
    (c) => c.uiType === "url" && BACKGROUND_NAME.test(c.name),
  );
  let mobile: string | null = null;
  let desktop: string | null = null;
  let generic: string | null = null;
  for (const col of backgroundCols) {
    if (!mobile && MOBILE_HINT.test(col.name)) mobile = col.name;
    else if (!desktop && DESKTOP_HINT.test(col.name)) desktop = col.name;
    else if (!generic) generic = col.name;
  }
  // A lone background column with no mobile/desktop hint still fills both frames.
  if (!mobile && !desktop && !generic && backgroundCols[0]) {
    generic = backgroundCols[0].name;
  }
  return {
    mobile,
    desktop,
    generic,
    all: backgroundCols.map((c) => c.name),
  };
}

// The wall's language column, used to filter walls by language.
export function detectLanguageField(
  columns: BlogColumnDefinition[],
): string | null {
  for (const name of ["language", "lang", "locale"]) {
    if (columns.some((c) => c.name === name)) return name;
  }
  return null;
}

// The boolean column that marks a wall as public / visible, used to filter and
// to default the list to public walls only.
export function detectPublicField(
  columns: BlogColumnDefinition[],
): string | null {
  const priority = [
    "is_public",
    "public",
    "is_published",
    "published",
    "is_visible",
    "visible",
    "is_active",
    "is_live",
  ];
  for (const name of priority) {
    const col = columns.find((c) => c.name === name);
    if (col && col.uiType === "boolean") return name;
  }
  const anyPublic = columns.find(
    (c) => c.uiType === "boolean" && /(public|publi|visible)/i.test(c.name),
  );
  return anyPublic?.name ?? null;
}

// Every column that holds an image URL — background artwork plus any uploaded
// image (cover, logo, avatar, hero…). Used to render thumbnails in the preview.
export function detectImageFields(columns: BlogColumnDefinition[]): string[] {
  return columns
    .filter((c) => c.uiType === "url" && IMAGE_NAME.test(c.name))
    .map((c) => c.name);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_OVERRIDES: Record<string, Partial<BlogColumnDefinition>> = {
  message: { uiType: "text", required: true, label: "Message" },
  content: { uiType: "text" },
  body: { uiType: "text" },
  text: { uiType: "text" },
};

export const MESSAGE_FALLBACK_COLUMNS: BlogColumnDefinition[] = [
  { name: "id", label: "Id", uiType: "text", required: false, readOnly: true },
  { name: "message", label: "Message", uiType: "text", required: true, readOnly: false },
  { name: "author", label: "Author", uiType: "text", required: false, readOnly: false },
];

export function inferMessageColumns(row: BlogRow | null): BlogColumnDefinition[] {
  return inferColumns(row, MESSAGE_OVERRIDES, MESSAGE_FALLBACK_COLUMNS);
}

export function isMultilineMessageField(column: BlogColumnDefinition): boolean {
  return (
    MULTILINE_MESSAGE_NAMES.has(column.name) ||
    column.uiType === "json" ||
    column.uiType === "stringArray" ||
    column.uiType === "numberArray"
  );
}

// The message column shown as the headline text in previews/cards.
export function detectMessageTextField(
  columns: BlogColumnDefinition[],
): string | null {
  const priority = ["message", "content", "body", "text", "comment", "note"];
  for (const name of priority) {
    if (columns.some((c) => c.name === name)) return name;
  }
  return columns.find((c) => c.uiType === "text" && !c.readOnly)?.name ?? null;
}

// The author / display-name column shown alongside a message.
export function detectMessageAuthorField(
  columns: BlogColumnDefinition[],
): string | null {
  const priority = [
    "author",
    "author_name",
    "name",
    "display_name",
    "pseudo",
    "nickname",
    "sender",
    "from",
  ];
  for (const name of priority) {
    if (columns.some((c) => c.name === name)) return name;
  }
  return null;
}

// The column holding a message's emoji / sticker character (e.g. "💛"). Used by
// the Happy Box grid to show a printable icon next to each message.
export function detectMessageEmojiField(
  columns: BlogColumnDefinition[],
): string | null {
  const priority = [
    "emoji",
    "emojis",
    "sticker",
    "reaction",
    "mood",
    "icon",
    "symbol",
    "feeling",
  ];
  for (const name of priority) {
    const col = columns.find((c) => c.name === name);
    // Emojis live in a plain text column, never a URL/number/boolean one.
    if (col && (col.uiType === "text" || col.uiType === "json")) return name;
  }
  // Any remaining text column whose name clearly means "emoji".
  return (
    columns.find(
      (c) =>
        (c.uiType === "text" || c.uiType === "json") &&
        /(emoji|sticker|reaction|mood)/i.test(c.name),
    )?.name ?? null
  );
}

// The column holding the writer's own picture — the avatar shown on the wall
// for who posted the message (distinct from any media attached to the message).
// On Happy-Milo's `happy_wall_message` this is the bare `url` column, which the
// image-name heuristic wouldn't match, so it's listed explicitly (last, after
// any clearly-named avatar/photo column).
export function detectMessageAvatarField(
  columns: BlogColumnDefinition[],
): string | null {
  const priority = [
    "avatar_url",
    "avatar",
    "author_image_url",
    "author_image",
    "profile_image_url",
    "profile_image",
    "image_url",
    "image",
    "photo_url",
    "photo",
    "picture_url",
    "picture",
    "url",
  ];
  for (const name of priority) {
    const col = columns.find((c) => c.name === name);
    if (col && col.uiType === "url") return name;
  }
  return null;
}

// The media content attached to a message (an image or a video the sender
// added), together with the column that says which it is. On Happy-Milo this is
// `gift_media_url` + `gift_media_type`. This is never the writer's avatar image.
export function detectMessageMediaField(
  columns: BlogColumnDefinition[],
): { url: string; type: string | null } | null {
  const urlPriority = [
    "gift_media_url",
    "media_url",
    "video_url",
    "attachment_url",
    "attachment",
    "media",
  ];
  let urlField: string | null = null;
  for (const name of urlPriority) {
    const col = columns.find((c) => c.name === name);
    if (col && col.uiType === "url") {
      urlField = name;
      break;
    }
  }
  if (!urlField) return null;
  const typePriority = ["gift_media_type", "media_type", "content_type", "video_type"];
  const typeField =
    typePriority.find((name) => columns.some((c) => c.name === name)) ?? null;
  return { url: urlField, type: typeField };
}

// The foreign-key column that links a message back to its wall.
export function detectMessageWallFk(
  columns: BlogColumnDefinition[],
  wallTable: string,
): string | null {
  const names = columns.map((c) => c.name);
  const candidates = [
    `${wallTable}_id`,
    "happy_wall_id",
    "hope_wall_id",
    "wall_id",
    "audience_id",
    "happy_wall_audience_id",
    "wall_slug",
    "happy_wall_slug",
  ];
  for (const candidate of candidates) {
    if (names.includes(candidate)) return candidate;
  }
  // Any remaining column that clearly references a wall.
  return (
    names.find((n) => /wall/i.test(n) && /(_id|_slug|id|slug)$/i.test(n)) ?? null
  );
}

// ---------------------------------------------------------------------------
// Table detection
// ---------------------------------------------------------------------------

async function tableExists(
  client: SupabaseClient,
  table: string,
): Promise<boolean> {
  const { error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .limit(1);
  return !error;
}

// Probes the likely message-table names for the connected DB. Derives the two
// most likely names from the wall table itself, then falls back to a static
// list covering the Happy-Milo / hope_wall naming history.
export function messageTableCandidates(wallTable: string): string[] {
  const derived = [`${wallTable}_message`, `${wallTable}_messages`];
  const known = [
    "happy_wall_message",
    "happy_wall_messages",
    "hope_wall_message",
    "hope_wall_messages",
    "happy_message",
    "wall_message",
    "wall_messages",
    "happy_wall_post",
    "happy_wall_bubble",
  ];
  return Array.from(new Set([...derived, ...known]));
}

export async function detectMessageTable(
  client: SupabaseClient,
  wallTable: string,
): Promise<string | null> {
  for (const candidate of messageTableCandidates(wallTable)) {
    if (await tableExists(client, candidate)) return candidate;
  }
  return null;
}
