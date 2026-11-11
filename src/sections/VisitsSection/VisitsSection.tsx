"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { RefreshRounded } from "@mui/icons-material";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BROWSERS_TABLE,
  computeVisitsAnalytics,
  topLabel,
  urlHost,
  type BrowserRow,
} from "@/lib/blogAnalytics";
import { parseUserAgent } from "@/lib/userAgent";
import { BarList, KpiTile } from "@/sections/ArticlesSection/ArticleAnalytics";
import {
  distGridSx,
  kpiGridSx,
  sparklineRowSx,
  sparklineWrapSx,
  statsPanelSx,
} from "@/sections/ArticlesSection/styles";

const ROWS_PER_PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// The daily chart never draws more bars than this, whatever the range.
const MAX_CHART_DAYS = 90;
const LATEST_STEP = 25;
const DIRECT_LABEL = "Direct / none";
const ALL_SOURCES = "__all__";

type RangePreset = "today" | "7d" | "30d" | "90d" | "all" | "custom";

const PRESETS: { value: RangePreset; label: string; days?: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

// Resolved date window: `fromMs` inclusive, `toMs` exclusive, null = open end.
interface DateWindow {
  fromMs: number | null;
  toMs: number | null;
}

interface VisitsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

// Local midnight of a `YYYY-MM-DD` date-input value, or null when incomplete.
function localDayStart(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const t = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).getTime();
  return Number.isNaN(t) ? null : t;
}

// Days are the user's local calendar days: "7 days" = today and the 6 before.
function resolveWindow(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
): DateWindow {
  if (preset === "all") return { fromMs: null, toMs: null };
  if (preset === "custom") {
    const from = localDayStart(customFrom);
    const to = localDayStart(customTo);
    return { fromMs: from, toMs: to === null ? null : to + DAY_MS };
  }
  const days = PRESETS.find((p) => p.value === preset)?.days ?? 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { fromMs: today.getTime() - (days - 1) * DAY_MS, toMs: null };
}

function sourceOf(row: BrowserRow): string {
  return urlHost(row.url_source) ?? DIRECT_LABEL;
}

export function VisitsSection({ isConnected, client }: VisitsSectionProps) {
  const [rows, setRows] = useState<BrowserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [source, setSource] = useState(ALL_SOURCES);
  const [latestLimit, setLatestLimit] = useState(LATEST_STEP);
  // Only the newest request may write state (ranges can change mid-flight).
  const requestRef = useRef(0);

  const { fromMs, toMs } = useMemo(
    () => resolveWindow(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const customInvalid =
    preset === "custom" && fromMs !== null && toMs !== null && fromMs >= toMs;
  // A custom range needs at least one bound before we query anything.
  const customEmpty = preset === "custom" && fromMs === null && toMs === null;

  const load = useCallback(async () => {
    if (!client || customInvalid || customEmpty) return;
    const request = ++requestRef.current;
    setLoading(true);
    setUnavailable(null);
    const all: BrowserRow[] = [];
    try {
      // The date window is applied by the database, so only matching rows
      // travel. PostgREST caps each response at max-rows, hence the paging.
      for (let from = 0; ; from += ROWS_PER_PAGE) {
        let query = client
          .from(BROWSERS_TABLE)
          .select("browser_signature, device, user_agent, url_source, created_at");
        if (fromMs !== null) {
          query = query.gte("created_at", new Date(fromMs).toISOString());
        }
        if (toMs !== null) {
          query = query.lt("created_at", new Date(toMs).toISOString());
        }
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range(from, from + ROWS_PER_PAGE - 1);
        if (error) throw error;
        if (request !== requestRef.current) return;
        const page = (data ?? []) as BrowserRow[];
        all.push(...page);
        if (page.length < ROWS_PER_PAGE) break;
      }
      setRows(all);
      setLatestLimit(LATEST_STEP);
    } catch (error) {
      if (request !== requestRef.current) return;
      setUnavailable(
        readableError(error, `Could not load ${BROWSERS_TABLE}.`),
      );
      setRows([]);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [client, fromMs, toMs, customInvalid, customEmpty]);

  useEffect(() => {
    if (!isConnected || !client) return;
    void load();
  }, [isConnected, client, load]);

  // Sources present in the loaded range, most common first, for the filter.
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = sourceOf(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // A source picked in one range may not exist in the next one.
  const activeSource = sourceOptions.some(([host]) => host === source)
    ? source
    : ALL_SOURCES;

  const visibleRows = useMemo(
    () =>
      activeSource === ALL_SOURCES
        ? rows
        : rows.filter((row) => sourceOf(row) === activeSource),
    [rows, activeSource],
  );

  // Daily chart window: the selected range, capped to MAX_CHART_DAYS bars.
  const chartEndMs = toMs !== null ? toMs - 1 : undefined;
  const chartDays = useMemo(() => {
    if (fromMs === null) return MAX_CHART_DAYS;
    const end = toMs ?? Date.now();
    return Math.min(
      MAX_CHART_DAYS,
      Math.max(1, Math.ceil((end - fromMs) / DAY_MS)),
    );
  }, [fromMs, toMs]);

  const analytics = useMemo(
    () =>
      computeVisitsAnalytics(visibleRows, {
        days: chartDays,
        endMs: chartEndMs,
      }),
    [visibleRows, chartDays, chartEndMs],
  );
  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const latest = visibleRows.slice(0, latestLimit);

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Visits · site traffic</Typography>
          <Typography variant="body2" color="text.secondary">
            One row per visitor browser (the <code>{BROWSERS_TABLE}</code>{" "}
            table). Repeat visits from the same browser are not counted twice.
          </Typography>
        </Box>
        <IconButton
          onClick={load}
          disabled={!isConnected || loading}
          aria-label="Refresh visits"
        >
          <RefreshRounded />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
          mb: 2,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={preset}
          onChange={(_, value: RangePreset | null) => {
            if (value) setPreset(value);
          }}
          aria-label="Date range"
          sx={{ flexWrap: "wrap" }}
        >
          {PRESETS.map((p) => (
            <ToggleButton key={p.value} value={p.value}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {preset === "custom" && (
          <>
            <TextField
              size="small"
              type="date"
              label="From"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              error={customInvalid}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              error={customInvalid}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}

        <TextField
          select
          size="small"
          label="Came from"
          value={activeSource}
          onChange={(e) => setSource(e.target.value)}
          disabled={sourceOptions.length === 0}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={ALL_SOURCES}>All sources</MenuItem>
          {sourceOptions.map(([host, count]) => (
            <MenuItem key={host} value={host}>
              {host} ({count})
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {!isConnected ? (
        <Alert severity="info">Connect to load visit statistics.</Alert>
      ) : customInvalid ? (
        <Alert severity="warning">
          The “From” date must be on or before the “To” date.
        </Alert>
      ) : customEmpty ? (
        <Alert severity="info">Pick a “From” and/or “To” date.</Alert>
      ) : unavailable ? (
        <Alert severity="warning">
          Could not load {BROWSERS_TABLE}: {unavailable}
        </Alert>
      ) : loading ? (
        <Alert severity="info">Loading visits…</Alert>
      ) : analytics.visitors === 0 ? (
        <Alert severity="info">No visits recorded in this period.</Alert>
      ) : (
        <Box sx={statsPanelSx}>
          <Box sx={kpiGridSx}>
            <KpiTile label="Visitors in period" value={analytics.visitors} />
            <KpiTile label="Unique browsers" value={analytics.uniqueVisitors} />
            <KpiTile
              label="Top source"
              value={topLabel(analytics.sources) ?? "—"}
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Last visit: {formatDate(analytics.lastVisitAt)}
          </Typography>

          {chartDays > 1 && (
            <Paper variant="outlined" sx={sparklineWrapSx}>
              <Typography variant="subtitle2">
                New visitors per day
                {preset === "all" ||
                (fromMs !== null &&
                  ((toMs ?? Date.now()) - fromMs) / DAY_MS > MAX_CHART_DAYS)
                  ? ` · last ${MAX_CHART_DAYS} days of the period`
                  : ""}
              </Typography>
              <Box
                sx={sparklineRowSx}
                role="img"
                aria-label="Daily new visitors over the selected period"
              >
                {analytics.perDay.map((day) => (
                  <Tooltip
                    key={day.day}
                    title={`${day.day}: ${day.count} visitors`}
                  >
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
          )}

          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Latest visitors
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Came from</TableCell>
                    <TableCell>Landing URL</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Browser · OS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latest.map((row, index) => {
                    const ua = parseUserAgent(row.user_agent);
                    const url = (row.url_source ?? "").trim();
                    return (
                      <TableRow
                        key={`${row.browser_signature ?? ""}-${row.created_at ?? ""}-${index}`}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {formatDate(row.created_at)}
                        </TableCell>
                        <TableCell>{sourceOf(row)}</TableCell>
                        <TableCell
                          title={url}
                          sx={{
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {url || "—"}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {ua.deviceType === "bot" ? (
                            <Chip size="small" label="bot" />
                          ) : (
                            (row.device ?? "").trim() || ua.deviceType
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {ua.browser} · {ua.os}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box
              sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                Showing {latest.length} of {visibleRows.length}
              </Typography>
              {visibleRows.length > latest.length && (
                <Button
                  size="small"
                  onClick={() => setLatestLimit((n) => n + LATEST_STEP)}
                >
                  Show more
                </Button>
              )}
            </Box>
          </Paper>

          <Box sx={distGridSx}>
            <BarList title="Traffic sources" slices={analytics.sources} />
            <BarList title="Devices" slices={analytics.devices} />
            <BarList title="Browsers" slices={analytics.browsers} />
            <BarList title="Operating systems" slices={analytics.os} />
            <BarList title="Landing URLs" slices={analytics.landingUrls} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}
