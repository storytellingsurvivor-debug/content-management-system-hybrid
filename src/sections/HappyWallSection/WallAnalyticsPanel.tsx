"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow } from "@/types/blog";
import {
  detectLanguageField,
  detectPublicField,
  inferWallColumns,
} from "@/lib/happyWallSchema";
import {
  computeWallAnalytics,
  DEFAULT_WALL_GOAL,
} from "@/lib/happyWallAnalytics";
import { BarList, KpiTile } from "@/sections/ArticlesSection/ArticleAnalytics";
import {
  distGridSx,
  kpiGridSx,
  sparklineRowSx,
  sparklineWrapSx,
  statsPanelSx,
} from "@/sections/ArticlesSection/styles";

const ROWS_PER_PAGE = 1000;

interface WallAnalyticsPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  table: string;
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function WallAnalyticsPanel({
  isConnected,
  client,
  table,
}: WallAnalyticsPanelProps) {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState(String(DEFAULT_WALL_GOAL));

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setUnavailable(null);
    const all: BlogRow[] = [];
    try {
      // Page through every wall so the counts include the oldest rows too.
      for (let from = 0; ; from += ROWS_PER_PAGE) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .order("id", { ascending: false })
          .range(from, from + ROWS_PER_PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as BlogRow[];
        all.push(...page);
        if (page.length < ROWS_PER_PAGE) break;
      }
      setRows(all);
    } catch (error) {
      setUnavailable(readableError(error, `Could not load ${table}.`));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [client, table]);

  useEffect(() => {
    if (!isConnected || !client) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client, table]);

  const columns = useMemo(() => inferWallColumns(rows[0] ?? null), [rows]);
  const publicField = useMemo(() => detectPublicField(columns), [columns]);
  const languageField = useMemo(() => detectLanguageField(columns), [columns]);

  const goal = useMemo(() => {
    const parsed = Number(goalInput);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : DEFAULT_WALL_GOAL;
  }, [goalInput]);

  const analytics = useMemo(
    () => computeWallAnalytics({ rows, publicField, languageField, goal }),
    [rows, publicField, languageField, goal],
  );

  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const monthMax =
    analytics.byMonth.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h6">Happy Walls · creation analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Every wall created in <code>{table}</code> — public and private —
            with progress toward your creation goal.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <TextField
            size="small"
            type="number"
            label="Goal"
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <Button variant="outlined" onClick={load} disabled={!isConnected || loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </Box>
      </Box>

      {!isConnected ? (
        <Alert severity="info">Connect to load Happy Wall analytics.</Alert>
      ) : unavailable ? (
        <Alert severity="warning">
          Could not load {table}: {unavailable}
        </Alert>
      ) : loading && rows.length === 0 ? (
        <Alert severity="info">Loading walls…</Alert>
      ) : analytics.total === 0 ? (
        <Alert severity="info">No Happy Walls created yet.</Alert>
      ) : (
        <Box sx={statsPanelSx}>
          {/* Goal progress toward the target number of created walls. */}
          <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 1,
                mb: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography variant="subtitle2">
                Goal · {analytics.total} / {analytics.goal} walls created
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {analytics.reached
                  ? "🎉 Goal reached!"
                  : `${analytics.remaining} to go · ${analytics.goalPercent}%`}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={analytics.goalPercent}
              aria-label={`Goal progress: ${analytics.total} of ${analytics.goal} walls`}
              sx={{ height: 12, borderRadius: 1 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              {analytics.reached
                ? "You have hit the target — set a higher goal to keep tracking."
                : analytics.projectedGoalDate
                  ? `At the last-30-day pace (${analytics.avgPerDayLast30.toFixed(
                      1,
                    )} walls/day) you reach ${analytics.goal} around ${formatDate(
                      analytics.projectedGoalDate,
                    )} (~${analytics.projectedDaysToGoal} days).`
                  : "No walls created in the last 30 days — no forecast yet. Create walls to project a completion date."}
            </Typography>
          </Paper>

          <Box sx={kpiGridSx}>
            <KpiTile label="Total created" value={analytics.total} />
            <KpiTile label="Public" value={analytics.publicCount} />
            <KpiTile label="Private" value={analytics.privateCount} />
            <KpiTile label="This month" value={analytics.createdThisMonth} />
            <KpiTile label="Last 7 days" value={analytics.createdLast7Days} />
            <KpiTile label="Last 30 days" value={analytics.createdLast30Days} />
            <KpiTile
              label="Avg / day (30d)"
              value={analytics.avgPerDayLast30.toFixed(1)}
            />
            <KpiTile
              label="Avg / day (all)"
              value={analytics.avgPerDayAllTime.toFixed(1)}
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            First wall: {formatDate(analytics.firstCreatedAt)} · latest:{" "}
            {formatDate(analytics.lastCreatedAt)}
          </Typography>

          <Paper variant="outlined" sx={sparklineWrapSx}>
            <Typography variant="subtitle2">
              Walls created · last 30 days
            </Typography>
            <Box
              sx={sparklineRowSx}
              role="img"
              aria-label="Happy Walls created per day over the last 30 days"
            >
              {analytics.perDay.map((day) => (
                <Tooltip key={day.day} title={`${day.day}: ${day.count} created`}>
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 3,
                      height: `${Math.max(
                        (day.count / sparkMax) * 100,
                        day.count > 0 ? 4 : 1,
                      )}%`,
                      backgroundColor:
                        day.count > 0
                          ? "primary.main"
                          : "action.disabledBackground",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Paper>

          {analytics.byMonth.length > 1 && (
            <Paper variant="outlined" sx={sparklineWrapSx}>
              <Typography variant="subtitle2">
                Walls created · by month
              </Typography>
              <Box
                sx={sparklineRowSx}
                role="img"
                aria-label="Happy Walls created per month"
              >
                {analytics.byMonth.map((month) => (
                  <Tooltip
                    key={month.day}
                    title={`${month.day}: ${month.count} created`}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 6,
                        height: `${Math.max(
                          (month.count / monthMax) * 100,
                          month.count > 0 ? 4 : 1,
                        )}%`,
                        backgroundColor:
                          month.count > 0
                            ? "secondary.main"
                            : "action.disabledBackground",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Paper>
          )}

          <Box sx={distGridSx}>
            <BarList title="Visibility" slices={analytics.visibility} />
            <BarList title="By language" slices={analytics.byLanguage} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}
