"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  BlogColumnDefinition,
  BlogRow,
  EditorMode,
  SubmitAction,
} from "@/types/blog";
import {
  fieldHelperText,
  type FieldGroup,
  isMultilineField,
} from "@/lib/happySpotSchema";
import {
  actionRowSx,
  contentGridSx,
  editorColumnSx,
  groupHeaderSx,
  groupSx,
  previewBoxSx,
  previewImageSx,
  previewSectionSx,
  sectionPaperSx,
} from "@/sections/TemplateEditorSection/styles";

interface TagOption {
  value: string;
  label: string;
}

// Maps a FK column (e.g. main_tag_id, tag_ids, category_id) to a dropdown of the
// related rows. `multiple` renders a multi-select stored as a newline list.
export interface RelationSelect {
  options: TagOption[];
  multiple: boolean;
}

interface HappyTableEditorProps {
  title: string;
  isConnected: boolean;
  isBusy: boolean;
  mode: EditorMode;
  columns: BlogColumnDefinition[];
  groups: FieldGroup[];
  values: BlogRow;
  validationError: string | null;
  relationSelects?: Record<string, RelationSelect>;
  onFieldChange: (key: string, value: unknown) => void;
  onSubmit: (action: SubmitAction) => void;
}

function fieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function listItems(value: unknown): string[] {
  return str(value)
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toDateTimeLocalValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function datetimeLocalInputToIso(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function ListPreview({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Box sx={previewSectionSx}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
        {items.map((item) => (
          <Typography component="li" variant="body2" key={item}>
            {item}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

export function HappyTableEditor({
  title,
  isConnected,
  isBusy,
  mode,
  columns,
  groups,
  values,
  validationError,
  relationSelects = {},
  onFieldChange,
  onSubmit,
}: HappyTableEditorProps) {
  const columnByName = new Map(columns.map((column) => [column.name, column]));
  const groupedNames = new Set(groups.flatMap((group) => group.fields));
  const otherColumns = columns.filter(
    (column) => !groupedNames.has(column.name),
  );
  // One label lookup across every relation (tags, categories, …) for the preview.
  const relationLabelById = new Map<string, string>();
  for (const relation of Object.values(relationSelects)) {
    for (const option of relation.options) {
      relationLabelById.set(option.value, option.label);
    }
  }

  const renderField = (column: BlogColumnDefinition) => {
    const value = values[column.name];

    // FK columns (main_tag_id, tag_ids, category_id, …) become dropdowns.
    const relation = relationSelects[column.name];
    if (relation && !relation.multiple) {
      return (
        <TextField
          key={column.name}
          select
          label={column.label}
          value={String(value ?? "")}
          onChange={(event) => onFieldChange(column.name, event.target.value)}
          helperText="Select one"
          fullWidth
        >
          <MenuItem value="">None</MenuItem>
          {relation.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    if (relation && relation.multiple) {
      const selected = listItems(value);
      return (
        <TextField
          key={column.name}
          select
          label={column.label}
          value={selected}
          onChange={(event) => {
            const raw = event.target.value as unknown as string[] | string;
            const next = Array.isArray(raw) ? raw : [raw];
            onFieldChange(column.name, next.filter(Boolean).join("\n"));
          }}
          slotProps={{
            select: {
              multiple: true,
              renderValue: (selectedIds) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {(selectedIds as string[]).map((id) => (
                    <Chip key={id} size="small" label={relationLabelById.get(id) ?? id} />
                  ))}
                </Box>
              ),
            },
          }}
          helperText="Select one or more"
          fullWidth
        >
          {relation.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    if (column.uiType === "boolean") {
      return (
        <FormControlLabel
          key={column.name}
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(event) => onFieldChange(column.name, event.target.checked)}
              disabled={column.readOnly}
            />
          }
          label={column.label}
        />
      );
    }

    const multiline = isMultilineField(column);
    const type =
      column.uiType === "number"
        ? "number"
        : column.uiType === "datetime"
          ? "datetime-local"
          : column.uiType === "url"
            ? "url"
            : "text";

    return (
      <TextField
        key={column.name}
        label={column.label}
        value={
          column.uiType === "datetime"
            ? toDateTimeLocalValue(value)
            : fieldValue(value)
        }
        onChange={(event) =>
          onFieldChange(
            column.name,
            column.uiType === "datetime"
              ? datetimeLocalInputToIso(event.target.value)
              : event.target.value,
          )
        }
        required={column.required}
        slotProps={{ input: { readOnly: column.readOnly } }}
        helperText={fieldHelperText(column) || undefined}
        multiline={multiline}
        minRows={multiline ? 3 : undefined}
        type={multiline ? "text" : type}
        fullWidth
      />
    );
  };

  const renderGroup = (
    groupTitle: string,
    groupColumns: BlogColumnDefinition[],
  ) => {
    if (groupColumns.length === 0) return null;
    return (
      <Box key={groupTitle} sx={groupSx}>
        <Typography sx={groupHeaderSx}>{groupTitle}</Typography>
        {groupColumns.map((column) => renderField(column))}
      </Box>
    );
  };

  // --- Live preview values (generic across spots + tags) ---
  const heading =
    str(values.name) ||
    str(values.label) ||
    str(values.title) ||
    str(values.slug) ||
    "Untitled";
  const slug = str(values.slug);
  const brand = str(values.brand);
  const language = str(values.language);
  const type = str(values.type);
  const emoji = str(values.emoji);
  const color = str(values.color);
  const isActive = values.is_active !== false;
  const isMain = values.is_main === true;
  const imageUrl = str(values.image_url);
  const validImage = isHttpUrl(imageUrl) ? imageUrl : "";
  const address = str(values.address);
  const city = str(values.city);
  const lat = str(values.lat);
  const lng = str(values.lng);
  const location = [address, city].filter(Boolean).join(", ");
  const description = str(values.note) || str(values.description);
  const markdown = str(values.markdown_content);
  const metadataTitle = str(values.metadata_title);
  const metadataDescription = str(values.metadata_description);
  const metadataKeywords = str(values.metadata_keywords);
  const mainTagLabel = relationLabelById.get(str(values.main_tag_id));
  const tagLabels = listItems(values.tag_ids).map(
    (id) => relationLabelById.get(id) ?? `#${id}`,
  );
  const categoryLabel = relationLabelById.get(str(values.category_id));
  const articleSlugs = listItems(values.article_blog_slugs);

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect and select/create a row before editing.
        </Alert>
      ) : (
        <>
          <Box sx={contentGridSx}>
            <Box sx={editorColumnSx}>
              {groups.map((group) =>
                renderGroup(
                  group.title,
                  group.fields
                    .map((name) => columnByName.get(name))
                    .filter((column): column is BlogColumnDefinition =>
                      Boolean(column),
                    ),
                ),
              )}
              {renderGroup("Other", otherColumns)}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Live Preview
              </Typography>
              <Box sx={previewBoxSx}>
                <Box sx={{ maxWidth: 720, mx: "auto" }}>
                  <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                    {brand && (
                      <Chip size="small" label={brand} color="primary" variant="outlined" />
                    )}
                    {language && <Chip size="small" label={language.toUpperCase()} />}
                    {type && <Chip size="small" label={type} variant="outlined" />}
                    {categoryLabel && (
                      <Chip size="small" label={categoryLabel} variant="outlined" />
                    )}
                    {isMain && <Chip size="small" label="Main" color="secondary" />}
                    <Chip
                      size="small"
                      label={isActive ? "Active" : "Inactive"}
                      color={isActive ? "success" : "default"}
                      variant={isActive ? "filled" : "outlined"}
                    />
                  </Box>

                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    {emoji ? `${emoji} ` : ""}
                    {heading}
                  </Typography>
                  {slug && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      /{slug}
                    </Typography>
                  )}

                  {(location || lat || lng) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      📍 {location}
                      {lat && lng ? ` (${lat}, ${lng})` : ""}
                    </Typography>
                  )}

                  {color && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: color,
                          border: (theme) => `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {color}
                      </Typography>
                    </Box>
                  )}

                  {validImage && (
                    <Box
                      component="img"
                      src={validImage}
                      alt={heading}
                      sx={{ ...previewImageSx, mb: 2 }}
                    />
                  )}

                  {description && (
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}
                    >
                      {description}
                    </Typography>
                  )}

                  {markdown && (
                    <Box
                      sx={{
                        "& p": { my: 1, lineHeight: 1.7 },
                        "& ul, & ol": { pl: 3, my: 1 },
                        "& img": { maxWidth: "100%", borderRadius: 1 },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdown}
                      </ReactMarkdown>
                    </Box>
                  )}

                  {(mainTagLabel || tagLabels.length > 0) && (
                    <Box sx={previewSectionSx}>
                      <Typography variant="caption" color="text.secondary">
                        Tags
                      </Typography>
                      {mainTagLabel && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          Main: {mainTagLabel}
                        </Typography>
                      )}
                      {tagLabels.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {tagLabels.map((label) => (
                            <Chip key={label} size="small" label={label} variant="outlined" />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                  <ListPreview label="Article blog slugs" items={articleSlugs} />

                  {(metadataTitle || metadataDescription || metadataKeywords) && (
                    <Box sx={previewSectionSx}>
                      <Typography variant="caption" color="text.secondary">
                        Metadata
                      </Typography>
                      {metadataTitle && (
                        <Typography variant="subtitle2">{metadataTitle}</Typography>
                      )}
                      {metadataDescription && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {metadataDescription}
                        </Typography>
                      )}
                      {metadataKeywords && (
                        <Typography variant="caption" color="text.disabled">
                          {metadataKeywords}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {validationError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {validationError}
            </Alert>
          )}

          <Box sx={actionRowSx}>
            <Button
              variant="contained"
              disabled={isBusy}
              onClick={() => onSubmit(mode === "create" ? "create" : "update")}
            >
              {mode === "create" ? "Create" : "Update"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={isBusy || mode !== "edit"}
              onClick={() => onSubmit("delete")}
            >
              Delete
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
