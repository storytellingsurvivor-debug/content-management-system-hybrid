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
import type {
  BlogColumnDefinition,
  BlogRow,
  EditorMode,
  SubmitAction,
} from "@/types/blog";
import {
  isLongTextField,
  TEMPLATE_LANGUAGE_OPTIONS,
} from "@/lib/templateFormSchema";
import { FaqField } from "@/components/FaqField";
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
} from "./styles";

interface TemplateEditorSectionProps {
  isConnected: boolean;
  isBusy: boolean;
  mode: EditorMode;
  columns: BlogColumnDefinition[];
  values: BlogRow;
  validationError: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onSubmit: (action: SubmitAction) => void;
}

interface FieldGroup {
  title: string;
  fields: string[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Identity",
    fields: ["id", "created_at", "brand", "slug", "language", "is_active"],
  },
  {
    title: "Hero",
    fields: [
      "hero_title",
      "hero_subtitle",
      "hero_description",
      "hero_bubble_message",
      "uploaded_image_url",
    ],
  },
  {
    title: "How It Works",
    fields: ["how_it_works_title", "how_it_works_description"],
  },
  {
    title: "Examples",
    fields: ["examples_section_title"],
  },
  {
    title: "Metadata",
    fields: ["metadata_title", "metadata_description"],
  },
  {
    title: "Content",
    fields: ["markdown_content"],
  },
  {
    title: "FAQ",
    fields: ["faq"],
  },
];

function fieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

function toDateTimeLocalValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function datetimeLocalInputToIso(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function TemplateEditorSection({
  isConnected,
  isBusy,
  mode,
  columns,
  values,
  validationError,
  onFieldChange,
  onSubmit,
}: TemplateEditorSectionProps) {
  const columnByName = new Map(
    columns.map((column) => [column.name, column]),
  );
  const groupedNames = new Set(
    FIELD_GROUPS.flatMap((group) => group.fields),
  );
  const otherColumns = columns.filter((column) => !groupedNames.has(column.name));

  const heroTitle =
    String(values.hero_title ?? "").trim() ||
    String(values.slug ?? "").trim() ||
    "Untitled template";
  const heroSubtitle = String(values.hero_subtitle ?? "").trim();
  const heroDescription = String(values.hero_description ?? "").trim();
  const heroBubbleMessage = String(values.hero_bubble_message ?? "").trim();
  const howTitle = String(values.how_it_works_title ?? "").trim();
  const howDescription = String(values.how_it_works_description ?? "").trim();
  const examplesTitle = String(values.examples_section_title ?? "").trim();
  const metadataTitle = String(values.metadata_title ?? "").trim();
  const metadataDescription = String(values.metadata_description ?? "").trim();
  const brand = String(values.brand ?? "").trim();
  const language = String(values.language ?? "").trim();
  const slug = String(values.slug ?? "").trim();
  const isActive = values.is_active !== false;
  const imageUrl = String(values.uploaded_image_url ?? "").trim();
  const validImageUrl = isHttpUrl(imageUrl) ? imageUrl : "";

  const renderField = (column: BlogColumnDefinition) => {
    const value = values[column.name];
    const createModeEditableSystemField =
      mode === "create" &&
      (column.name === "id" || column.name === "created_at");
    const isReadOnly = column.readOnly && !createModeEditableSystemField;

    if (column.uiType === "boolean") {
      return (
        <FormControlLabel
          key={column.name}
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(event) =>
                onFieldChange(column.name, event.target.checked)
              }
              disabled={isReadOnly}
            />
          }
          label={column.label}
        />
      );
    }

    if (column.uiType === "faq") {
      return (
        <FaqField
          key={column.name}
          label={column.label}
          value={value}
          onChange={(next) => onFieldChange(column.name, next)}
        />
      );
    }

    if (column.name === "language") {
      return (
        <TextField
          key={column.name}
          select
          label={column.label}
          value={fieldValue(value)}
          onChange={(event) => onFieldChange(column.name, event.target.value)}
          required={column.required}
          slotProps={{ input: { readOnly: isReadOnly } }}
          fullWidth
        >
          {TEMPLATE_LANGUAGE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option.toUpperCase()}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    const multiline = isLongTextField(column.name);
    const rows = multiline ? 4 : 1;
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
        slotProps={{ input: { readOnly: isReadOnly } }}
        multiline={multiline}
        rows={rows}
        type={type}
        fullWidth
      />
    );
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        3. Template Editor
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect and select/create a template before editing.
        </Alert>
      ) : (
        <>
          <Box sx={contentGridSx}>
            <Box sx={editorColumnSx}>
              {FIELD_GROUPS.map((group) => {
                const groupColumns = group.fields
                  .map((name) => columnByName.get(name))
                  .filter((column): column is BlogColumnDefinition =>
                    Boolean(column),
                  );
                if (groupColumns.length === 0) return null;
                return (
                  <Box key={group.title} sx={groupSx}>
                    <Typography sx={groupHeaderSx}>{group.title}</Typography>
                    {groupColumns.map((column) => renderField(column))}
                  </Box>
                );
              })}

              {otherColumns.length > 0 && (
                <Box sx={groupSx}>
                  <Typography sx={groupHeaderSx}>Other</Typography>
                  {otherColumns.map((column) => renderField(column))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Live Preview
              </Typography>
              <Box sx={previewBoxSx}>
                <Box sx={{ maxWidth: 720, mx: "auto" }}>
                  <Box
                    sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}
                  >
                    {brand && (
                      <Chip
                        size="small"
                        label={brand}
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {language && (
                      <Chip size="small" label={language.toUpperCase()} />
                    )}
                    <Chip
                      size="small"
                      label={isActive ? "Active" : "Inactive"}
                      color={isActive ? "success" : "default"}
                      variant={isActive ? "filled" : "outlined"}
                    />
                  </Box>

                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    {heroTitle}
                  </Typography>
                  {slug && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      /{slug}
                    </Typography>
                  )}
                  {heroSubtitle && (
                    <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                      {heroSubtitle}
                    </Typography>
                  )}

                  {validImageUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Uploaded image
                      </Typography>
                      <Box
                        component="img"
                        src={validImageUrl}
                        alt="Template cover"
                        sx={previewImageSx}
                      />
                    </Box>
                  )}

                  {heroDescription && (
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}
                    >
                      {heroDescription}
                    </Typography>
                  )}

                  {heroBubbleMessage && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        mb: 2,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Hero bubble
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {heroBubbleMessage}
                      </Typography>
                    </Paper>
                  )}

                  {(howTitle || howDescription) && (
                    <Box sx={previewSectionSx}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {howTitle || "How it works"}
                      </Typography>
                      {howDescription && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {howDescription}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {examplesTitle && (
                    <Box sx={previewSectionSx}>
                      <Typography variant="subtitle2">
                        {examplesTitle}
                      </Typography>
                    </Box>
                  )}

                  {(metadataTitle || metadataDescription) && (
                    <Box sx={previewSectionSx}>
                      <Typography variant="caption" color="text.secondary">
                        Metadata
                      </Typography>
                      {metadataTitle && (
                        <Typography variant="subtitle2">
                          {metadataTitle}
                        </Typography>
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
            {mode === "create" ? (
              <Button
                variant="contained"
                disabled={isBusy}
                onClick={() => onSubmit("create")}
              >
                Create
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={isBusy}
                onClick={() => onSubmit("update")}
              >
                Update
              </Button>
            )}
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
