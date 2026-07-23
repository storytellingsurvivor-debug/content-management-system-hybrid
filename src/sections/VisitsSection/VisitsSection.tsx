"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { RefreshRounded } from "@mui/icons-material";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BROWSERS_TABLE,
  computeVisitsAnalytics,
  type BrowserRow,
} from "@/lib/blogAnalytics";
import { BarList, KpiTile } from "@/sections/ArticlesSection/ArticleAnalytics";
import {
  distGridSx,
  kpiGridSx,
  sparklineRowSx,
  sparklineWrapSx,
  statsPanelSx,
} from "@/sections/ArticlesSection/styles";

const ROWS_PER_PAGE = 1000;

interface VisitsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function VisitsSection({ isConnected, client }: VisitsSectionProps) {
  const [rows, setRows] = useState<BrowserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setUnavailable(null);
    const all: BrowserRow[] = [];
    try {
      // Page through the whole table; PostgREST caps each response at max-rows.
      for (let from = 0; ; from += ROWS_PER_PAGE) {
        const { data, error } = await client
          .from(BROWSERS_TABLE)
          .select("browser_signature, device, user_agent, url_source, created_at")
          .order("created_at", { ascending: false })
          .range(from, from + ROWS_PER_PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as BrowserRow[];
        all.push(...page);
        if (page.length < ROWS_PER_PAGE) break;
      }
      setRows(all);
    } catch (error) {
      setUnavailable(
        readableError(error, `Could not load ${BROWSERS_TABLE}.`),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!isConnected || !client) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const analytics = useMemo(() => computeVisitsAnalytics(rows), [rows]);
  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;

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
        <IconButton onClick={load} disabled={!isConnected || loading}>
          <RefreshRounded />
        </IconButton>
      </Box>

      {!isConnected ? (
        <Alert severity="info">Connect to load visit statistics.</Alert>
      ) : unavailable ? (
        <Alert severity="warning">
          Could not load {BROWSERS_TABLE}: {unavailable}
        </Alert>
      ) : loading && rows.length === 0 ? (
        <Alert severity="info">Loading visits…</Alert>
      ) : analytics.visitors === 0 ? (
        <Alert severity="info">No visits recorded yet.</Alert>
      ) : (
        <Box sx={statsPanelSx}>
          <Box sx={kpiGridSx}>
            <KpiTile label="Visitors" value={analytics.visitors} />
            <KpiTile label="Unique browsers" value={analytics.uniqueVisitors} />
            <KpiTile label="Last 7 days" value={analytics.last7Days} />
            <KpiTile label="Last 30 days" value={analytics.last30Days} />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Last visit: {formatDate(analytics.lastVisitAt)}
          </Typography>

          <Paper variant="outlined" sx={sparklineWrapSx}>
            <Typography variant="subtitle2">
              New visitors · last 30 days
            </Typography>
            <Box
              sx={sparklineRowSx}
              role="img"
              aria-label="Daily new visitors over the last 30 days"
            >
              {analytics.perDay.map((day) => (
                <Tooltip key={day.day} title={`${day.day}: ${day.count} visitors`}>
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

          <Box sx={distGridSx}>
            <BarList title="Traffic sources" slices={analytics.sources} />
            <BarList title="Devices" slices={analytics.devices} />
            <BarList title="Browsers" slices={analytics.browsers} />
            <BarList title="Operating systems" slices={analytics.os} />
            <BarList title="Landing URLs" slices={analytics.landingUrls} />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Button onClick={load} disabled={loading} variant="outlined">
              Refresh
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
