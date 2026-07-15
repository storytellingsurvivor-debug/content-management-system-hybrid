"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
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
  BUBBLES_EFFECT_LABELS,
  BUBBLES_EFFECTS,
  BUBBLES_FORMATION_LABELS,
  BUBBLES_FORMATION_MODES,
  DEFAULT_ANIMATION_DURATION_SECONDS,
  getChoreographyTotalMs,
  parseBubblesChoreography,
  validateChoreography,
  type BubblesChoreographyStep,
  type BubblesEffect,
  type BubblesFormationMode,
} from "@/lib/bubblesChoreographySchema";

const DEFAULT_STEP_SECONDS = 4;

// "300s (5 min 0s)" — spells the duration in both seconds and minutes.
function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return `${s}s (${min} min ${rem}s)`;
}

interface HappyWallSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
  // "happy_wall" on Happy-Milo, "hope_wall" on older DBs (resolved at connect).
  table: string;
}

type WallRow = {
  id: number;
  slug: string | null;
  title_or_description: string | null;
  bubbles_choreography: unknown;
  animation_duration: number | null;
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
  table,
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
  const [draftEffects, setDraftEffects] = useState<BubblesEffect[]>([]);
  const [animationSeconds, setAnimationSeconds] = useState(
    DEFAULT_ANIMATION_DURATION_SECONDS,
  );

  const totalSeconds = useMemo(
    () => getChoreographyTotalMs(steps) / 1000,
    [steps],
  );
  const validationErrors = useMemo(
    () => validateChoreography(steps, loop, animationSeconds),
    [steps, loop, animationSeconds],
  );

  const applyWall = useCallback((row: WallRow | undefined) => {
    const parsed = row ? parseBubblesChoreography(row.bubbles_choreography) : null;
    setSteps(parsed?.steps ?? []);
    setLoop(parsed?.loop ?? true);
    setAnimationSeconds(
      row && typeof row.animation_duration === "number" && row.animation_duration > 0
        ? row.animation_duration / 1000
        : DEFAULT_ANIMATION_DURATION_SECONDS,
    );
    setError(null);
  }, []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setUnavailable(null);
    const { data, error: loadError } = await client
      .from(table)
      .select("id, slug, title_or_description, bubbles_choreography, animation_duration")
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
  }, [client, table, selectedId, applyWall]);

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
      {
        mode: draftMode,
        durationMs: Math.round(seconds * 1000),
        ...(draftEffects.length > 0 && { effects: [...draftEffects] }),
      },
    ]);
  };

  const toggleDraftEffect = (effect: BubblesEffect) => {
    setDraftEffects((prev) =>
      prev.includes(effect)
        ? prev.filter((e) => e !== effect)
        : [...prev, effect],
    );
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
      `PROD action: type PROD to confirm UPDATE on ${table}.`,
    );
    return answer === "PROD";
  };

  const save = async () => {
    if (!client || !selectedId) return;
    setError(null);
    onFeedback(null);
    if (!Number.isFinite(animationSeconds) || animationSeconds <= 0) {
      setError("Animation duration must be greater than 0 seconds.");
      return;
    }
    // Empty === clear the wall's choreography; only guard non-empty ones.
    if (steps.length > 0) {
      const errors = validateChoreography(steps, loop, animationSeconds);
      if (errors.length > 0) {
        setError(`Fix before saving: ${errors.join(" ")}`);
        return;
      }
    }
    if (!confirmProd()) {
      onFeedback("Action cancelled: PROD confirmation not accepted.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        bubbles_choreography: steps.length > 0 ? { steps, loop } : null,
        animation_duration: Math.round(animationSeconds * 1000),
      };
      const { data, error: updateError } = await client
        .from(table)
        .update(payload)
        .eq("id", Number(selectedId))
        .select("id, slug, title_or_description, bubbles_choreography, animation_duration");
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error(
          `Update affected 0 rows. Either the wall #${selectedId} is gone, or the anon key can't UPDATE ${table} (missing RLS UPDATE policy for the anon role on ${table} in this environment).`,
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
          Could not load `{table}`: {unavailable}
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

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <TextField
                size="small"
                type="number"
                label="Animation duration (seconds)"
                value={animationSeconds}
                onChange={(e) => setAnimationSeconds(Number(e.target.value))}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                sx={{ width: 200 }}
              />
              <Typography variant="body2" color="text.secondary">
                = {formatDurationLabel(animationSeconds)} ·{" "}
                {Math.round(animationSeconds * 1000)} ms saved
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              How long the whole show (music card + bubbles + effects) stays on
              before it stops. Non-looping choreography longer than this gets cut.
            </Typography>

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

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Effects on this step:
              </Typography>
              {BUBBLES_EFFECTS.map((effect) => (
                <FormControlLabel
                  key={effect}
                  control={
                    <Checkbox
                      size="small"
                      checked={draftEffects.includes(effect)}
                      onChange={() => toggleDraftEffect(effect)}
                    />
                  }
                  label={BUBBLES_EFFECT_LABELS[effect]}
                />
              ))}
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
                      {step.effects && step.effects.length > 0
                        ? ` · ${step.effects
                            .map((e) => BUBBLES_EFFECT_LABELS[e])
                            .join(" + ")}`
                        : ""}
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

            {steps.length > 0 && validationErrors.length > 0 && (
              <Alert severity="warning">
                <Stack spacing={0.25}>
                  {validationErrors.map((message) => (
                    <span key={message}>{message}</span>
                  ))}
                </Stack>
              </Alert>
            )}

            <Box>
              <Button
                variant="contained"
                color="success"
                onClick={save}
                disabled={
                  submitting ||
                  (steps.length > 0 && validationErrors.length > 0)
                }
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
