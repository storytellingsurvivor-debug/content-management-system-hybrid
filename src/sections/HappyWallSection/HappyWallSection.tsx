"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import {
  BUBBLES_FORMATION_LABELS,
  BUBBLES_FORMATION_MODES,
  getChoreographyTotalMs,
  parseBubblesChoreography,
  type BubblesChoreographyStep,
  type BubblesFormationMode,
} from "@/lib/bubblesChoreographySchema";

const HOPE_WALL_TABLE = "hope_wall";
const DEFAULT_STEP_SECONDS = 4;

interface HappyWallSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

type WallRow = {
  id: number;
  slug: string | null;
  title_or_description: string | null;
  bubbles_choreography: unknown;
};

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function HappyWallSection({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappyWallSectionProps) {
  const [rows, setRows] = useState<WallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [steps, setSteps] = useState<BubblesChoreographyStep[]>([]);
  const [loop, setLoop] = useState(true);
  const [draftMode, setDraftMode] = useState<BubblesFormationMode>("heart");
  const [draftSeconds, setDraftSeconds] = useState(DEFAULT_STEP_SECONDS);

  const totalSeconds = useMemo(
    () => getChoreographyTotalMs(steps) / 1000,
    [steps],
  );

  const applyWall = useCallback((row: WallRow | undefined) => {
    const parsed = row ? parseBubblesChoreography(row.bubbles_choreography) : null;
    setSteps(parsed?.steps ?? []);
    setLoop(parsed?.loop ?? true);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setUnavailable(null);
    const { data, error: loadError } = await client
      .from(HOPE_WALL_TABLE)
      .select("id, slug, title_or_description, bubbles_choreography")
      .order("id", { ascending: false })
      .limit(500);
    setLoading(false);
    if (loadError) {
      setUnavailable(readableError(loadError, "Failed to load hope walls."));
      setRows([]);
      return;
    }
    const nextRows = (data ?? []) as WallRow[];
    setRows(nextRows);
    // Keep the current selection if it still exists, else reset.
    const stillThere = nextRows.find((row) => String(row.id) === selectedId);
    if (!stillThere) {
      setSelectedId("");
      applyWall(undefined);
    } else {
      applyWall(stillThere);
    }
  }, [client, selectedId, applyWall]);

  useEffect(() => {
    if (!isConnected || !client) return;
    void load();
    // Load once connected; load identity changes with client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const selectWall = (value: string) => {
    setSelectedId(value);
    applyWall(rows.find((row) => String(row.id) === value));
  };

  const addStep = () => {
    const seconds = Number.isFinite(draftSeconds) ? draftSeconds : 0;
    if (seconds <= 0) return;
    setSteps((prev) => [
      ...prev,
      { mode: draftMode, durationMs: Math.round(seconds * 1000) },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const confirmProd = (): boolean => {
    if (environment !== "PROD") return true;
    const answer = window.prompt(
      `PROD action: type PROD to confirm UPDATE on ${HOPE_WALL_TABLE}.`,
    );
    return answer === "PROD";
  };

  const save = async () => {
    if (!client || !selectedId) return;
    setError(null);
    onFeedback(null);
    if (!confirmProd()) {
      onFeedback("Action cancelled: PROD confirmation not accepted.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        bubbles_choreography: steps.length > 0 ? { steps, loop } : null,
      };
      const { data, error: updateError } = await client
        .from(HOPE_WALL_TABLE)
        .update(payload)
        .eq("id", Number(selectedId))
        .select("id, slug, title_or_description, bubbles_choreography");
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error(
          `Update affected 0 rows. Either the wall #${selectedId} is gone, or the anon key can't UPDATE ${HOPE_WALL_TABLE} (missing RLS UPDATE policy for the anon role on ${HOPE_WALL_TABLE} in this environment).`,
        );
      }
      onFeedback("Bubble choreography saved successfully.");
      await load();
    } catch (submitError) {
      setError(readableError(submitError, "Failed to save choreography."));
    } finally {
      setSubmitting(false);
    }
  };

  const clearAll = () => {
    setSteps([]);
    setError(null);
  };

  const wallOptions = useMemo(
    () =>
      rows.map((row) => {
        const title = String(row.title_or_description ?? "").trim();
        const slug = String(row.slug ?? "").trim();
        const hasChoreo = parseBubblesChoreography(row.bubbles_choreography)
          ? " ✓"
          : "";
        return {
          value: String(row.id),
          label: `${title || slug || `wall #${row.id}`} (#${row.id})${hasChoreo}`,
        };
      }),
    [rows],
  );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6">Happy Wall — Bubbles choreography</Typography>
          <Typography variant="body2" color="text.secondary">
            Pick a wall, chain the bubble formations with their durations, and
            save. Plays on the wall after the 1-2-3 event countdown.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={!isConnected || loading}>
          <RefreshRounded />
        </IconButton>
      </Box>

      {unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{HOPE_WALL_TABLE}`: {unavailable}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        <Select
          size="small"
          displayEmpty
          value={selectedId}
          onChange={(e) => selectWall(String(e.target.value))}
          disabled={!isConnected}
          fullWidth
        >
          <MenuItem value="">
            {loading ? "Loading walls…" : "Select a wall…"}
          </MenuItem>
          {wallOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>

        {selectedId ? (
          <>
            <Divider />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Select
                size="small"
                value={draftMode}
                onChange={(e) =>
                  setDraftMode(e.target.value as BubblesFormationMode)
                }
                sx={{ minWidth: 220 }}
              >
                {BUBBLES_FORMATION_MODES.map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {BUBBLES_FORMATION_LABELS[mode]}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                size="small"
                type="number"
                label="seconds"
                value={draftSeconds}
                onChange={(e) => setDraftSeconds(Number(e.target.value))}
                slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
                sx={{ width: 110 }}
              />
              <Button variant="contained" onClick={addStep}>
                Add step
              </Button>
            </Box>

            <Divider />

            {steps.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No steps yet — add formations above.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {steps.map((step, index) => (
                  <Box
                    key={index}
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {index + 1}. {BUBBLES_FORMATION_LABELS[step.mode]} —{" "}
                      {(step.durationMs / 1000).toFixed(1)}s
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUpwardRounded fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                    >
                      <ArrowDownwardRounded fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeStep(index)}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Total: {totalSeconds.toFixed(1)}s {loop ? "(loops)" : "(once)"}
              </Typography>
              <Button size="small" onClick={() => setLoop((v) => !v)}>
                {loop ? "Loop: on" : "Loop: off"}
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={clearAll}
                disabled={steps.length === 0}
              >
                Clear
              </Button>
            </Box>

            <Box>
              <Button
                variant="contained"
                color="success"
                onClick={save}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save choreography"}
              </Button>
            </Box>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}
