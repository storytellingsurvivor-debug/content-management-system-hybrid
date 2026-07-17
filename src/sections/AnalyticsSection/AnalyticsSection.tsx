"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  BLOG_VIEW_TABLE,
  blogViewTableExists,
  computeArticleAnalytics,
  type BlogViewRow,
  type DistributionSlice,
} from "@/lib/blogAnalytics";
import {
  barLabelRowSx,
  barRowSx,
  controlsGridSx,
  distCardSx,
  distGridSx,
  kpiGridSx,
  kpiTileSx,
  sectionHeaderSx,
  sectionPaperSx,
  sparklineRowSx,
  sparklineWrapSx,
} from "./styles";

interface AnalyticsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  articles: BlogRow[];
  onFeedback: (message: string | null) => void;
}

// Load recent view events, newest first, paging until we hit `MAX_ROWS`. This
// keeps the client memory bounded on busy tables while still covering the
// windows the dashboard reports on (7 / 30 days).
const ROWS_PER_PAGE = 1000;
const MAX_ROWS = 20000;

async function fetchViewRows(client: SupabaseClient): Promise<BlogViewRow[]> {
  const all: BlogViewRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += ROWS_PER_PAGE) {
    const to = Math.min(from + ROWS_PER_PAGE, MAX_ROWS) - 1;
    const { data, error } = await client
      .from(BLOG_VIEW_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const batch = (data ?? []) as BlogViewRow[];
    all.push(...batch);
    if (batch.length < ROWS_PER_PAGE) break;
  }
  return all;
}

function articleTitle(row: BlogRow): string {
  return (
    String(row.title ?? row.slug ?? "").trim() || String(row.slug ?? "").trim()
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function BarList({
  title,
  slices,
  emptyLabel = "No data yet",
}: {
  title: string;
  slices: DistributionSlice[];
  emptyLabel?: string;
}) {
  const max = slices.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  return (
    <Paper variant="outlined" sx={distCardSx}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {slices.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        slices.map((slice) => (
          <Box key={slice.label} sx={barRowSx}>
            <Box sx={barLabelRowSx}>
              <Box
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  pr: 1,
                }}
                title={slice.label}
              >
                {slice.label}
              </Box>
              <Box component="span" sx={{ color: "text.secondary", flexShrink: 0 }}>
                {slice.count} · {slice.percent}%
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(slice.count / max) * 100}
              aria-label={`${title}: ${slice.label}, ${slice.count} views (${slice.percent}%)`}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        ))
      )}
    </Paper>
  );
}

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={kpiTileSx}>
      <Typography variant="h4" component="div">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export function AnalyticsSection({
  isConnected,
  client,
  environment,
  articles,
  onFeedback,
}: AnalyticsSectionProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [rows, setRows] = useState<BlogViewRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<string>(""); // "" = all articles, else slug

  const slugToTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const article of articles) {
      const slug = String(article.slug ?? "").trim();
      if (slug) map.set(slug, articleTitle(article));
    }
    return map;
  }, [articles]);

  const load = async (probe = true) => {
    if (!client) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (probe) {
        const exists = await blogViewTableExists(client);
        setAvailable(exists);
        if (!exists) {
          setRows([]);
          setIsLoading(false);
          return;
        }
      }
      const data = await fetchViewRows(client);
      setRows(data);
      setAvailable(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load analytics.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !client) {
      setAvailable(null);
      setRows([]);
      return;
    }
    void load(true);
    // Load once per connected client; `load` is stable enough for this probe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  // Distinct slugs that actually have view events, most-viewed first.
  const trackedSlugs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const slug = String(row.article_slug ?? "").trim();
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug);
  }, [rows]);

  const scopedRows = useMemo(
    () =>
      scope
        ? rows.filter((row) => String(row.article_slug ?? "").trim() === scope)
        : rows,
    [rows, scope],
  );

  const analytics = useMemo(
    () => computeArticleAnalytics(scope || "all", scopedRows),
    [scope, scopedRows],
  );

  const topArticles = useMemo(() => {
    if (scope) return [];
    return trackedSlugs.slice(0, 8).map((slug) => ({
      label: slugToTitle.get(slug) ?? slug,
      count: rows.filter(
        (row) => String(row.article_slug ?? "").trim() === slug,
      ).length,
      percent: 0,
    }));
  }, [scope, trackedSlugs, rows, slugToTitle]);

  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  if (!isConnected) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Typography variant="h6" sx={sectionHeaderSx}>
          Blog analytics
        </Typography>
        <Alert severity="info">
          Connect to Supabase first to see per-article views, browsers and
          traffic sources.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h6">Blog analytics</Typography>
        <Chip label={environment} size="small" variant="outlined" />
      </Box>

      {available === false ? (
        <Alert severity="warning">
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            The `{BLOG_VIEW_TABLE}` table doesn&apos;t exist on this database
            yet.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Run the migration{" "}
            <code>supabase/migrations/20260717_blog_view_analytics.sql</code>{" "}
            (Supabase → SQL editor), then add the tracker to your public blog
            article pages — see <code>docs/blog-analytics.md</code>. Once views
            start coming in, refresh this tab.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => load(true)}>
            Re-check
          </Button>
        </Alert>
      ) : (
        <>
          <Box sx={controlsGridSx}>
            <TextField
              select
              label="Article"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              disabled={isLoading}
              fullWidth
            >
              <MenuItem value="">All articles</MenuItem>
              {trackedSlugs.map((slug) => (
                <MenuItem key={slug} value={slug}>
                  {slugToTitle.get(slug) ?? slug}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              onClick={() => {
                void load(false);
                onFeedback("Analytics refreshed.");
              }}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
            <Chip
              label={`${scopedRows.length} view event(s)`}
              variant="outlined"
              sx={{ alignSelf: "center" }}
            />
          </Box>

          {errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {!isLoading && rows.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No view events recorded yet. Add the tracker script to your public
              blog article pages (see <code>docs/blog-analytics.md</code>).
            </Alert>
          )}

          <Box sx={kpiGridSx}>
            <KpiTile label="Total views" value={analytics.totalViews} />
            <KpiTile
              label="Unique visitors"
              value={analytics.uniqueVisitors}
            />
            <KpiTile label="Last 7 days" value={analytics.viewsLast7Days} />
            <KpiTile label="Last 30 days" value={analytics.viewsLast30Days} />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Last view: {formatDate(analytics.lastViewedAt)}
          </Typography>

          <Paper variant="outlined" sx={sparklineWrapSx}>
            <Typography variant="subtitle2">Views · last 30 days</Typography>
            <Box sx={sparklineRowSx} role="img" aria-label="Daily views over the last 30 days">
              {analytics.perDay.map((day) => (
                <Tooltip key={day.day} title={`${day.day}: ${day.count} views`}>
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 3,
                      height: `${Math.max((day.count / sparkMax) * 100, day.count > 0 ? 4 : 1)}%`,
                      backgroundColor:
                        day.count > 0 ? "primary.main" : "action.disabledBackground",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Paper>

          {!scope && topArticles.length > 0 && (
            <>
              <Divider sx={{ mt: 3 }} />
              <Box sx={{ mt: 2 }}>
                <BarList title="Top articles by views" slices={topArticles} />
              </Box>
            </>
          )}

          <Box sx={distGridSx}>
            <BarList title="Browsers" slices={analytics.browsers} />
            <BarList title="Devices" slices={analytics.devices} />
            <BarList
              title="Traffic sources (UTM / referrer)"
              slices={analytics.sources}
            />
            <BarList title="Operating systems" slices={analytics.os} />
            <BarList title="Referrer domains" slices={analytics.referrers} />
            <BarList title="Landing URLs" slices={analytics.landingUrls} />
          </Box>
        </>
      )}
    </Paper>
  );
}
