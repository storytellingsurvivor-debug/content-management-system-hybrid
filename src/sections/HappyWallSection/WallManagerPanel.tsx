"use client";

import { useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  detectBackgroundFields,
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

  const wallOptions = useMemo(
    () =>
      wall.rows.map((row) => {
        const id = String(row.id ?? "").trim();
        const label =
          str(row.title_or_description) ||
          str(row.name) ||
          str(row.slug) ||
          `wall #${id}`;
        return { value: id ? `id:${id}` : "", label: `${label} (#${id})` };
      }),
    [wall.rows],
  );

  const title =
    str(wall.form.title_or_description) ||
    str(wall.form.name) ||
    str(wall.form.slug) ||
    "Untitled wall";
  const mobileField = background.mobile ?? background.generic;
  const desktopField = background.desktop ?? background.generic;
  const mobileUrl = mobileField ? str(wall.form[mobileField]) : "";
  const desktopUrl = desktopField ? str(wall.form[desktopField]) : "";

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
            <Button variant="contained" onClick={wall.createNew}>
              Create new
            </Button>
          </Box>

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
              />
              {background.all.length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No background-image column detected on `{table}`. Add a
                  background URL column (e.g. `background_image_url_mobile` /
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
              onClick={() =>
                wall.submit(wall.mode === "create" ? "create" : "update")
              }
            >
              {wall.mode === "create" ? "Create wall" : "Update wall"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={wall.submitting || wall.mode !== "edit"}
              onClick={() => wall.submit("delete")}
            >
              Delete wall
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
