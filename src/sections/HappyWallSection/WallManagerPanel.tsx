"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  detectBackgroundFields,
  detectImageFields,
  detectLanguageField,
  detectPublicField,
  inferWallColumns,
} from "@/lib/happyWallSchema";
import {
  actionRowSx,
  contentGridSx,
  editorColumnSx,
  groupHeaderSx,
  groupSx,
  sectionPaperSx,
} from "@/sections/TemplateEditorSection/styles";
import { AdaptiveField } from "./AdaptiveField";
import { BackgroundPreview } from "./BackgroundPreview";
import { useAdaptiveTable } from "./useAdaptiveTable";

export interface SelectedWall {
  id: string;
  slug: string;
  title: string;
}

interface WallManagerPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  table: string;
  onSelectWall: (wall: SelectedWall | null) => void;
  onFeedback: (message: string | null) => void;
}

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

const IDENTITY_FIELDS = [
  "id",
  "created_at",
  "slug",
  "title_or_description",
  "language",
  "name",
  "is_active",
  "is_live",
];
const ANIMATION_FIELDS = ["animation_duration", "bubbles_choreography"];

// Groups the runtime-discovered wall columns into Identity / Background /
// Animation / Other so the editor stays readable across schema variants.
function buildGroups(
  columns: BlogColumnDefinition[],
  backgroundNames: string[],
): { title: string; columns: BlogColumnDefinition[] }[] {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const used = new Set<string>();
  const pick = (names: string[]) =>
    names
      .map((n) => byName.get(n))
      .filter((c): c is BlogColumnDefinition => {
        if (!c || used.has(c.name)) return false;
        used.add(c.name);
        return true;
      });

  const identity = pick(IDENTITY_FIELDS);
  const background = pick(backgroundNames);
  const animation = pick(ANIMATION_FIELDS);
  const rest = columns.filter((c) => !used.has(c.name));

  return [
    { title: "Identity", columns: identity },
    { title: "Background artwork", columns: background },
    { title: "Animation", columns: animation },
    { title: "Other", columns: rest },
  ].filter((group) => group.columns.length > 0);
}

const MULTILINE_WALL_NAMES = new Set([
  "title_or_description",
  "description",
  "bubbles_choreography",
]);

export function WallManagerPanel({
  isConnected,
  client,
  environment,
  table,
  onSelectWall,
  onFeedback,
}: WallManagerPanelProps) {
  const wall = useAdaptiveTable({
    client,
    table,
    label: "Wall",
    inferColumns: inferWallColumns,
    environment,
    onFeedback,
  });

  useEffect(() => {
    if (!isConnected || !client) return;
    void wall.load();
    // Load once connected; hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  // Keep the shared selection (used by the Messages tab) in sync. Report the
  // selected wall's real id/slug so messages can be filtered by their FK.
  useEffect(() => {
    const id = str(wall.form.id);
    if (!wall.selectedId || !id) {
      onSelectWall(null);
      return;
    }
    onSelectWall({
      id,
      slug: str(wall.form.slug),
      title:
        str(wall.form.title_or_description) ||
        str(wall.form.name) ||
        str(wall.form.slug) ||
        `wall #${id}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall.selectedId, wall.form.id]);

  const background = useMemo(
    () => detectBackgroundFields(wall.columns),
    [wall.columns],
  );
  const groups = useMemo(
    () => buildGroups(wall.columns, background.all),
    [wall.columns, background.all],
  );

  // --- Filters: by language and by public flag (defaults to public only) ---
  const languageField = useMemo(
    () => detectLanguageField(wall.columns),
    [wall.columns],
  );
  const publicField = useMemo(
    () => detectPublicField(wall.columns),
    [wall.columns],
  );
  const [languageFilter, setLanguageFilter] = useState("");
  const [publicFilter, setPublicFilter] = useState<"public" | "private" | "all">(
    "public",
  );

  const distinctLanguages = useMemo(() => {
    if (!languageField) return [];
    return Array.from(
      new Set(
        wall.rows.map((row) => str(row[languageField])).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [wall.rows, languageField]);

  const filteredRows = useMemo(
    () =>
      wall.rows.filter((row) => {
        if (
          languageField &&
          languageFilter &&
          str(row[languageField]) !== languageFilter
        ) {
          return false;
        }
        if (publicField && publicFilter !== "all") {
          const isPublic = row[publicField] === true;
          if (publicFilter === "public" && !isPublic) return false;
          if (publicFilter === "private" && isPublic) return false;
        }
        return true;
      }),
    [wall.rows, languageField, languageFilter, publicField, publicFilter],
  );

  const wallOptions = useMemo(() => {
    const toOption = (row: BlogRow) => {
      const id = String(row.id ?? "").trim();
      const label =
        str(row.title_or_description) ||
        str(row.name) ||
        str(row.slug) ||
        `wall #${id}`;
      return { value: id ? `id:${id}` : "", label: `${label} (#${id})` };
    };
    const options = filteredRows.map(toOption);
    // Keep the current selection listed even if the filters would hide it, so
    // the dropdown value stays valid after filtering.
    if (
      wall.selectedId &&
      !options.some((option) => option.value === wall.selectedId)
    ) {
      const selectedRow = wall.rows.find(
        (row) => `id:${String(row.id ?? "").trim()}` === wall.selectedId,
      );
      if (selectedRow) options.unshift(toOption(selectedRow));
    }
    return options;
  }, [filteredRows, wall.rows, wall.selectedId]);

  const title =
    str(wall.form.title_or_description) ||
    str(wall.form.name) ||
    str(wall.form.slug) ||
    "Untitled wall";
  const mobileField = background.mobile ?? background.generic;
  const desktopField = background.desktop ?? background.generic;
  const mobileUrl = mobileField ? str(wall.form[mobileField]) : "";
  const desktopUrl = desktopField ? str(wall.form[desktopField]) : "";

  // Any other uploaded image on the wall (cover, logo, hero…) — everything that
  // isn't already shown in the mobile/desktop background frames.
  const galleryImages = useMemo(() => {
    const usedForBackground = new Set(
      [mobileField, desktopField].filter((name): name is string => Boolean(name)),
    );
    return detectImageFields(wall.columns)
      .filter((name) => !usedForBackground.has(name))
      .map((name) => ({ name, url: str(wall.form[name]) }));
  }, [wall.columns, wall.form, mobileField, desktopField]);

  const hasSelection = Boolean(wall.selectedId);

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Walls — manage &amp; preview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pick a wall to edit its title, background artwork and settings. The
        selection is shared with the Messages and Bubbles choreography tabs.
      </Typography>

      {wall.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{table}`: {wall.unavailable}
        </Alert>
      )}

      {!isConnected ? (
        <Alert severity="info">Connect to Supabase first.</Alert>
      ) : (
        <>
          {(languageField || publicField) && (
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
                mb: 1.5,
              }}
            >
              {languageField && (
                <TextField
                  select
                  size="small"
                  label="Language"
                  value={languageFilter}
                  onChange={(event) => setLanguageFilter(event.target.value)}
                  sx={{ minWidth: 180 }}
                  disabled={distinctLanguages.length === 0}
                >
                  <MenuItem value="">All languages</MenuItem>
                  {distinctLanguages.map((language) => (
                    <MenuItem key={language} value={language}>
                      {language.toUpperCase()}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {publicField && (
                <TextField
                  select
                  size="small"
                  label="Visibility"
                  value={publicFilter}
                  onChange={(event) =>
                    setPublicFilter(
                      event.target.value as "public" | "private" | "all",
                    )
                  }
                  helperText={`based on \`${publicField}\``}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="public">Public only</MenuItem>
                  <MenuItem value="private">Private only</MenuItem>
                  <MenuItem value="all">All</MenuItem>
                </TextField>
              )}
              <Box sx={{ flex: 1 }} />
              <Box sx={{ alignSelf: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  {filteredRows.length}/{wall.rows.length} wall(s)
                </Typography>
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              mb: 2,
            }}
          >
            <Select
              size="small"
              displayEmpty
              value={wall.selectedId}
              onChange={(event) => wall.select(String(event.target.value))}
              fullWidth
            >
              <MenuItem value="">
                {wall.loading ? "Loading walls…" : "Select a wall…"}
              </MenuItem>
              {wallOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <Button variant="outlined" onClick={() => wall.load()} disabled={wall.loading}>
              {wall.loading ? "Refreshing…" : "Refresh"}
            </Button>
          </Box>

          {!hasSelection ? (
            <Alert severity="info">
              Select a wall above to edit its content and preview its artwork.
            </Alert>
          ) : (
          <>
          <Box sx={contentGridSx}>
            <Box sx={editorColumnSx}>
              {groups.map((group) => (
                <Box key={group.title} sx={groupSx}>
                  <Typography sx={groupHeaderSx}>{group.title}</Typography>
                  {group.columns.map((column) => (
                    <AdaptiveField
                      key={column.name}
                      column={column}
                      value={wall.form[column.name]}
                      multiline={
                        MULTILINE_WALL_NAMES.has(column.name) ||
                        column.uiType === "json"
                      }
                      onChange={(value) => wall.changeField(column.name, value)}
                    />
                  ))}
                </Box>
              ))}
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                Background preview
              </Typography>
              <BackgroundPreview
                title={title}
                mobileUrl={mobileUrl}
                desktopUrl={desktopUrl}
                mobileField={mobileField}
                desktopField={desktopField}
                extraImages={galleryImages}
              />
              {background.all.length === 0 && galleryImages.length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No image column detected on `{table}`. Add a background/image
                  URL column (e.g. `background_image_url_mobile` /
                  `background_image_url_desktop`) to preview artwork here.
                </Alert>
              )}
            </Box>
          </Box>

          {wall.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {wall.error}
            </Alert>
          )}

          <Divider sx={{ mt: 2 }} />
          <Box sx={actionRowSx}>
            <Button
              variant="contained"
              disabled={wall.submitting}
              onClick={() => wall.submit("update")}
            >
              {wall.submitting ? "Saving…" : "Update wall"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={wall.submitting}
              onClick={() => wall.submit("delete")}
            >
              Delete wall
            </Button>
          </Box>
          </>
          )}
        </>
      )}
    </Paper>
  );
}
