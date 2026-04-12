"use client";

import {
  Alert,
  Avatar,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  BlogColumnDefinition,
  BlogRow,
  EditorMode,
  SubmitAction,
} from "@/types/blog";
import {
  actionRowSx,
  contentGridSx,
  editorColumnSx,
  markdownPaperSx,
  previewBoxSx,
  sectionPaperSx,
} from "./styles";

interface ContentSectionProps {
  isConnected: boolean;
  isBusy: boolean;
  mode: EditorMode;
  columns: BlogColumnDefinition[];
  values: BlogRow;
  validationError: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onSubmit: (action: SubmitAction) => void;
}

function fieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

function toDateTimeLocalValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Already in datetime-local compatible format.
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

function normalizeMarkdownUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("?")) {
    return raw;
  }
  if (raw.startsWith("//")) return `https:${raw}`;

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) {
    try {
      const url = new URL(raw);
      if (
        url.protocol === "https:" ||
        url.protocol === "http:" ||
        url.protocol === "mailto:" ||
        url.protocol === "tel:"
      ) {
        return raw;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) {
    return `https://${raw}`;
  }

  return raw;
}

function isExternalMarkdownUrl(value: string): boolean {
  return isHttpUrl(value);
}

function resolveFirstValidUrl(
  values: BlogRow,
  candidateKeys: string[],
): string {
  for (const key of candidateKeys) {
    const raw = String(values[key] ?? "").trim();
    if (isHttpUrl(raw)) return raw;
  }
  return "";
}

export function ContentSection({
  isConnected,
  isBusy,
  mode,
  columns,
  values,
  validationError,
  onFieldChange,
  onSubmit,
}: ContentSectionProps) {
  const contentMarkdown = String(values.content ?? "");
  const previewTitle = String(
    values.title ?? values.slug ?? "Untitled article",
  );
  const previewCategory = String(values.category ?? "").trim();
  const previewLanguage = String(
    values.language ?? values.lang ?? values.locale ?? "",
  ).trim();
  const previewSlug = String(values.slug ?? "").trim();
  const authorName = String(values.author_name ?? "Unknown Author").trim();
  const authorAvatarUrl = resolveFirstValidUrl(values, [
    "author_url",
    "author_avatar",
    "author_avatar_url",
    "author_image",
    "author_image_url",
    "avatar_url",
  ]);
  const coverUrl = resolveFirstValidUrl(values, [
    "cover_url",
    "background_cover",
    "background_cover_url",
    "background_image",
    "background_image_url",
    "cover_image",
    "cover_image_url",
    "image_url",
  ]);
  const markdownComponents: Components = {
    a: ({ href, children }) => {
      const safeHref = normalizeMarkdownUrl(String(href ?? ""));
      if (!safeHref) {
        return (
          <Typography
            component="span"
            color="text.secondary"
            sx={{ textDecoration: "line-through" }}
          >
            {children}
          </Typography>
        );
      }

      const external = isExternalMarkdownUrl(safeHref);
      return (
        <Box
          component="a"
          href={safeHref}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          sx={{
            color: "primary.main",
            textDecorationColor: "primary.main",
            overflowWrap: "anywhere",
          }}
        >
          {children}
        </Box>
      );
    },
    img: ({ src, alt }) => {
      const safeSrc = normalizeMarkdownUrl(String(src ?? ""));
      if (!safeSrc) {
        return (
          <Typography variant="body2" color="warning.main" sx={{ my: 1 }}>
            Invalid image URL in markdown.
          </Typography>
        );
      }

      return (
        <Box
          component="img"
          src={safeSrc}
          alt={String(alt ?? "")}
          loading="lazy"
          sx={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            borderRadius: 1,
            objectFit: "cover",
            my: 1.5,
          }}
        />
      );
    },
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        3. Content
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect and select/create an article before editing content.
        </Alert>
      ) : (
        <>
          <Box sx={contentGridSx}>
            <Box sx={editorColumnSx}>
              {columns.map((column) => {
                const value = values[column.name];
                const createModeEditableSystemField =
                  mode === "create" &&
                  (column.name === "id" || column.name === "created_at");
                const isReadOnly =
                  column.readOnly && !createModeEditableSystemField;
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

                const multiline = column.uiType === "markdown";
                const rows = multiline ? 16 : 1;
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
                    required={
                      column.required ||
                      (mode === "create" && column.name === "id")
                    }
                    slotProps={{ input: { readOnly: isReadOnly } }}
                    multiline={multiline}
                    rows={rows}
                    type={type}
                    fullWidth
                  />
                );
              })}
            </Box>

            <Box
              sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
            >
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Live Preview
              </Typography>
              <Box sx={previewBoxSx}>
                <Box sx={{ maxWidth: 920, mx: "auto" }}>
                  {(previewCategory || previewLanguage) && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {previewCategory ? `Category: ${previewCategory}` : ""}
                      {previewCategory && previewLanguage ? " | " : ""}
                      {previewLanguage ? `Language: ${previewLanguage}` : ""}
                    </Typography>
                  )}
                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    {previewTitle}
                  </Typography>
                  {previewSlug && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      /{previewSlug}
                    </Typography>
                  )}

                  <Box
                    sx={{
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                    }}
                  >
                    <Avatar
                      src={authorAvatarUrl || undefined}
                      alt={authorName}
                      sx={{ width: 40, height: 40 }}
                    >
                      {authorName ? authorName.charAt(0).toUpperCase() : "A"}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Author
                      </Typography>
                      <Typography variant="body1">
                        {authorName || "Unknown"}
                      </Typography>
                    </Box>
                  </Box>

                  {coverUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Background Cover
                      </Typography>
                      <Box
                        component="img"
                        src={coverUrl}
                        alt="Background cover"
                        sx={{
                          display: "block",
                          width: "100%",
                          borderRadius: 1.5,
                          border: (theme) =>
                            `1px solid ${theme.palette.divider}`,
                          objectFit: "cover",
                          maxHeight: 360,
                          mt: 0.75,
                        }}
                      />
                    </Box>
                  )}

                  <Paper variant="outlined" sx={markdownPaperSx}>
                    {contentMarkdown.trim() ? (
                      <Box
                        sx={{
                          "& p": { my: 1.25, lineHeight: 1.7 },
                          "& h1, & h2, & h3, & h4, & h5, & h6": {
                            mt: 2,
                            mb: 1,
                          },
                          "& ul, & ol": { pl: 3, my: 1.25 },
                          "& li": { mb: 0.5 },
                          "& blockquote": {
                            m: 0,
                            pl: 2,
                            py: 0.5,
                            borderLeft: (theme) =>
                              `3px solid ${theme.palette.divider}`,
                            color: "text.secondary",
                          },
                          "& pre": {
                            p: 1.5,
                            borderRadius: 1,
                            overflowX: "auto",
                            bgcolor: "action.hover",
                          },
                          "& code": {
                            px: 0.5,
                            py: 0.15,
                            borderRadius: 0.5,
                            bgcolor: "action.hover",
                            fontSize: "0.875em",
                          },
                          "& table": {
                            width: "100%",
                            borderCollapse: "collapse",
                            my: 1.5,
                            display: "block",
                            overflowX: "auto",
                          },
                          "& th, & td": {
                            border: (theme) =>
                              `1px solid ${theme.palette.divider}`,
                            p: 0.75,
                            textAlign: "left",
                          },
                          "& img": {
                            display: "block",
                            width: "100%",
                            maxWidth: "100%",
                            height: "auto",
                            borderRadius: 1,
                            objectFit: "cover",
                          },
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {contentMarkdown}
                        </ReactMarkdown>
                      </Box>
                    ) : (
                      <Typography color="text.secondary">
                        Content preview will appear here.
                      </Typography>
                    )}
                  </Paper>
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
