"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow } from "@/types/blog";
import type { DistributionSlice } from "@/lib/blogAnalytics";
import {
  detectLanguageField,
  detectPublicField,
  inferWallColumns,
} from "@/lib/happyWallSchema";
import {
  computeWallAnalytics,
  DEFAULT_WALL_GOAL,
  type FocusInsight,
  type WallAnalytics,
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

const TONE_SEVERITY: Record<FocusInsight["tone"], "success" | "warning" | "info"> =
  {
    positive: "success",
    warning: "warning",
    info: "info",
  };

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// byWeekday -> the slice shape BarList expects (percent of the busiest day).
function weekdaySlices(a: WallAnalytics): DistributionSlice[] {
  const max = a.byWeekday.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  return a.byWeekday.map((d) => ({
    label: d.weekday,
    count: d.count,
    percent: Math.round((d.count / max) * 1000) / 10,
  }));
}

// The big goal ring: total in the middle, progress around the edge.
function GoalRing({ analytics }: { analytics: WallAnalytics }) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={132}
        thickness={5}
        sx={{ color: "rgba(255,255,255,0.25)" }}
      />
      <CircularProgress
        variant="determinate"
        value={analytics.goalPercent}
        size={132}
        thickness={5}
        sx={{
          color: "common.white",
          position: "absolute",
          left: 0,
          "& .MuiCircularProgress-circle": { strokeLinecap: "round" },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ lineHeight: 1, color: "common.white" }}>
            {analytics.total}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.85)" }}
          >
            of {analytics.goal}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
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
  const [targetDate, setTargetDate] = useState("");

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
    () =>
      computeWallAnalytics({
        rows,
        publicField,
        languageField,
        goal,
        targetDate: targetDate || null,
      }),
    [rows, publicField, languageField, goal, targetDate],
  );

  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const monthMax =
    analytics.byMonth.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  const momentum = analytics.weekMomentumPct;

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
          <Typography variant="h6">Happy Walls · your road to the goal</Typography>
          <Typography variant="body2" color="text.secondary">
            Every wall created in <code>{table}</code> — public and private —
            with momentum, streaks and where to focus next.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="number"
            label="Goal"
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            sx={{ width: 100 }}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <TextField
            size="small"
            type="date"
            label="Target date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            sx={{ width: 170 }}
            slotProps={{ inputLabel: { shrink: true } }}
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
        <Alert severity="info">
          No Happy Walls created yet — create your first one and this board
          starts cheering you on toward {analytics.goal}.
        </Alert>
      ) : (
        <Box sx={statsPanelSx}>
          {/* Motivational hero: goal ring + headline + momentum. */}
          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              color: "common.white",
              background:
                "linear-gradient(120deg, #4F46E5 0%, #6366F1 45%, #EC4899 120%)",
              boxShadow: "0 18px 40px -24px rgba(79,70,229,0.65)",
              display: "flex",
              alignItems: "center",
              gap: { xs: 2, sm: 3 },
              flexWrap: "wrap",
            }}
          >
            <GoalRing analytics={analytics} />
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                {analytics.reached
                  ? "🎉 Goal reached — incredible!"
                  : `${analytics.remaining} walls to go`}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.9)", mb: 1.5 }}>
                {analytics.reached
                  ? `You've created ${analytics.total} Happy Walls. Raise the goal to keep climbing.`
                  : analytics.targetDate && analytics.requiredPerDay !== null
                    ? `Hit ${analytics.goal} by ${formatDate(
                        analytics.targetDate,
                      )} → create ${analytics.requiredPerDay.toFixed(
                        1,
                      )}/day (you're at ${analytics.avgPerDayLast30.toFixed(1)}/day).`
                    : analytics.projectedGoalDate
                      ? `At your recent pace you'll get there around ${formatDate(
                          analytics.projectedGoalDate,
                        )}.`
                      : "Create a few walls to kick-start your pace and see a finish date."}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip
                  label={`${analytics.goalPercent}% complete`}
                  sx={{
                    color: "#4F46E5",
                    bgcolor: "rgba(255,255,255,0.95)",
                    fontWeight: 700,
                  }}
                />
                {momentum !== null && (
                  <Chip
                    label={`${momentum >= 0 ? "▲" : "▼"} ${Math.abs(
                      momentum,
                    )}% vs last week`}
                    sx={{
                      color: "common.white",
                      bgcolor:
                        momentum >= 0
                          ? "rgba(22,163,74,0.9)"
                          : "rgba(220,38,38,0.9)",
                      fontWeight: 700,
                    }}
                  />
                )}
                {analytics.currentStreakDays > 0 && (
                  <Chip
                    label={`🔥 ${analytics.currentStreakDays}-day streak`}
                    sx={{
                      color: "common.white",
                      bgcolor: "rgba(255,255,255,0.2)",
                      fontWeight: 700,
                    }}
                  />
                )}
                {analytics.nextMilestone !== null && (
                  <Chip
                    label={`Next milestone: ${analytics.nextMilestone} (${analytics.toNextMilestone} away)`}
                    sx={{
                      color: "common.white",
                      bgcolor: "rgba(255,255,255,0.2)",
                      fontWeight: 700,
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Where to focus: the prioritised clue list. */}
          {analytics.insights.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Where to focus
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {analytics.insights.map((insight, i) => (
                  <Alert key={i} severity={TONE_SEVERITY[insight.tone]} icon={false}>
                    <strong>
                      {insight.icon} {insight.title}
                    </strong>{" "}
                    — {insight.detail}
                  </Alert>
                ))}
              </Box>
            </Box>
          )}

          {/* Deadline pace check (only when a target date is set). */}
          {analytics.targetDate &&
            analytics.requiredPerDay !== null &&
            !analytics.reached && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
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
                    Pace check · {formatDate(analytics.targetDate)}
                  </Typography>
                  <Chip
                    size="small"
                    color={analytics.onTrackForDeadline ? "success" : "warning"}
                    label={
                      analytics.onTrackForDeadline ? "On track" : "Behind pace"
                    }
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {analytics.daysUntilTarget !== null &&
                  analytics.daysUntilTarget > 0
                    ? `${analytics.daysUntilTarget} days left · need ${analytics.requiredPerDay.toFixed(
                        1,
                      )} walls/day · running ${analytics.avgPerDayLast30.toFixed(
                        1,
                      )}/day (last 30d).`
                    : "The target date has already passed — set a new one."}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    analytics.requiredPerDay > 0
                      ? (analytics.avgPerDayLast30 / analytics.requiredPerDay) * 100
                      : 100,
                  )}
                  color={analytics.onTrackForDeadline ? "success" : "warning"}
                  sx={{ height: 8, borderRadius: 1, mt: 1 }}
                />
              </Paper>
            )}

          {/* Momentum & consistency at a glance. */}
          <Box sx={kpiGridSx}>
            <KpiTile label="Today" value={analytics.createdToday} />
            <KpiTile label="This week" value={analytics.createdLast7Days} />
            <KpiTile label="This month" value={analytics.createdThisMonth} />
            <KpiTile label="Current streak" value={`${analytics.currentStreakDays}d`} />
            <KpiTile label="Best streak" value={`${analytics.longestStreakDays}d`} />
            <KpiTile
              label="Best day"
              value={analytics.bestDay ? analytics.bestDay.count : 0}
            />
            <KpiTile
              label="Active days (30d)"
              value={`${analytics.activeDaysLast30}/30`}
            />
            <KpiTile
              label="Avg / day (30d)"
              value={analytics.avgPerDayLast30.toFixed(1)}
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            First wall: {formatDate(analytics.firstCreatedAt)} · latest:{" "}
            {formatDate(analytics.lastCreatedAt)} ·{" "}
            {analytics.publicCount} public / {analytics.privateCount} private
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
            <BarList title="Best days of the week" slices={weekdaySlices(analytics)} />
            <BarList title="By language" slices={analytics.byLanguage} />
            <BarList title="Visibility" slices={analytics.visibility} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}
