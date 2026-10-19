"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow } from "@/types/blog";
import {
  BLOG_VIEWS_TABLE,
  BROWSERS_TABLE,
  type BlogViewRow,
  type BrowserRow,
} from "@/lib/blogAnalytics";
import { fetchBrowsers, fetchViewRows } from "@/lib/blogAnalyticsQueries";
import { ArticlePerformance } from "./ArticlePerformance";
import { filtersRowSx, sectionHeaderRowSx, sectionPaperSx } from "./styles";

interface PerformanceSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  articles: BlogRow[];
  onSelectArticle: (value: string) => void;
}

function language(row: BlogRow): string {
  for (const key of ["language", "lang", "locale"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function liveStatus(row: BlogRow): "live" | "off" | "" {
  for (const key of ["is_live", "is_active"]) {
    const value = row[key];
    if (typeof value === "boolean") return value ? "live" : "off";
  }
  return "";
}

// Global article performance, as its own section: closed by default and the
// readership rows are only fetched the first time it is opened.
export function PerformanceSection({
  isConnected,
  client,
  articles,
  onSelectArticle,
}: PerformanceSectionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<SupabaseClient | null>(null);
  const [viewRows, setViewRows] = useState<BlogViewRow[]>([]);
  const [browsers, setBrowsers] = useState<Map<string, BrowserRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const rows = await fetchViewRows(client);
      const signatures = Array.from(
        new Set(
          rows
            .map((row) => String(row.browser_signature ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      );
      setBrowsers(await fetchBrowsers(client, signatures));
      setViewRows(rows);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load analytics.";
      setViewRows([]);
      setBrowsers(new Map());
      // A missing table is a setup state on that brand's DB, not an error.
      if (/does not exist|schema cache/i.test(message)) setUnavailable(true);
      else setError(message);
    } finally {
      setLoadedFor(client);
      setLoading(false);
    }
  }, [client]);

  // Fetch on first open, and again after switching connection while open.
  // `loadedFor` is set when the fetch settles, so this fires once per client.
  useEffect(() => {
    if (!open || !isConnected || !client || loadedFor === client) return;
    void load();
  }, [open, isConnected, client, loadedFor, load]);

  // The article opens in sections 2–3 at the top of the page; take the user
  // there so the click has a visible effect.
  const selectArticle = (id: string) => {
    onSelectArticle(`id:${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const languages = useMemo(
    () => Array.from(new Set(articles.map(language).filter(Boolean))).sort(),
    [articles],
  );
  const hasStatus = useMemo(
    () => articles.some((a) => liveStatus(a) !== ""),
    [articles],
  );

  const filtered = useMemo(
    () =>
      articles.filter(
        (a) =>
          (!languageFilter || language(a) === languageFilter) &&
          (!statusFilter || liveStatus(a) === statusFilter),
      ),
    [articles, languageFilter, statusFilter],
  );

  const isLoaded = loadedFor === client && client !== null;

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box sx={sectionHeaderRowSx}>
        <Box>
          <Typography variant="h6">5. Performance overview</Typography>
          <Typography variant="body2" color="text.secondary">
            Every article ranked by readership, with health labels and a
            per-category roll-up. Robots &amp; bots excluded.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {open && isConnected && (
            <Tooltip title="Reload readership">
              <span>
                <IconButton onClick={() => void load()} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            onClick={() => setOpen((value) => !value)}
            startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"}
          </Button>
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        {!isConnected ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Connect to Supabase first to see article performance.
          </Alert>
        ) : unavailable ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            This database has no <code>{BLOG_VIEWS_TABLE}</code> /{" "}
            <code>{BROWSERS_TABLE}</code> table, so there is nothing to measure
            — see <code>docs/blog-analytics.md</code>.
          </Alert>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : !isLoaded || (loading && viewRows.length === 0) ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Loading readership…
          </Alert>
        ) : (
          <>
            <Box sx={filtersRowSx}>
              <TextField
                select
                size="small"
                label="Language"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                disabled={languages.length === 0}
              >
                <MenuItem value="">All languages</MenuItem>
                {languages.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={!hasStatus}
              >
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="live">Live / Active</MenuItem>
                <MenuItem value="off">Inactive</MenuItem>
              </TextField>
            </Box>
            <ArticlePerformance
              articles={filtered}
              viewRows={viewRows}
              browsers={browsers}
              onSelectArticle={selectArticle}
            />
          </>
        )}
      </Collapse>
    </Paper>
  );
}
