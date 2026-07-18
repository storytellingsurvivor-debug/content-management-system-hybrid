"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import {
  BLOG_VIEWS_TABLE,
  BROWSERS_TABLE,
  computeAnalyticsByArticle,
  computeBlogAnalytics,
  type BlogAnalytics,
  type BlogViewRow,
  type BrowserRow,
} from "@/lib/blogAnalytics";
import { ArticleAnalytics } from "./ArticleAnalytics";
import { ArticleCard } from "./ArticleCard";
import {
  controlsGridSx,
  infoRowSx,
  scrollRowSx,
  sectionHeaderSx,
  sectionPaperSx,
  statsToggleWrapSx,
} from "./styles";

interface ArticlesSectionProps {
  isConnected: boolean;
  isLoading: boolean;
  client: SupabaseClient | null;
  articles: BlogRow[];
  selectedArticleId: string;
  columns: BlogColumnDefinition[];
  onSelectArticle: (value: string) => void;
  onCreateNew: () => void;
  onRefresh: () => void | Promise<void>;
}

// Page through the view rows, newest first, up to `MAX_ROWS` — enough to cover
// the windows we report on without unbounded client memory.
const ROWS_PER_PAGE = 1000;
const MAX_ROWS = 20000;

async function fetchViewRows(client: SupabaseClient): Promise<BlogViewRow[]> {
  const all: BlogViewRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += ROWS_PER_PAGE) {
    const to = Math.min(from + ROWS_PER_PAGE, MAX_ROWS) - 1;
    const { data, error } = await client
      .from(BLOG_VIEWS_TABLE)
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

// `browsers` covers every site visitor, not just blog readers, so fetch only
// the signatures we saw — chunked, to keep the request URL short.
async function fetchBrowsers(
  client: SupabaseClient,
  signatures: string[],
): Promise<Map<string, BrowserRow>> {
  const bySignature = new Map<string, BrowserRow>();
  const CHUNK = 200;
  for (let i = 0; i < signatures.length; i += CHUNK) {
    const { data, error } = await client
      .from(BROWSERS_TABLE)
      .select("*")
      .in("browser_signature", signatures.slice(i, i + CHUNK));
    if (error) throw error;
    for (const row of (data ?? []) as BrowserRow[]) {
      const signature = String(row.browser_signature ?? "").trim();
      if (signature) bySignature.set(signature, row);
    }
  }
  return bySignature;
}

function articleOptionValue(row: BlogRow): string {
  const id = String(row.id ?? "").trim();
  if (id) return `id:${id}`;
  const slug = String(row.slug ?? "").trim();
  return slug ? `slug:${slug}` : "";
}

function pickField(row: BlogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function articleTitle(row: BlogRow): string {
  return (
    pickField(row, "title", "slug") || `Article #${String(row.id ?? "").trim()}`
  );
}

// "live" / "off" from is_live or is_active, "" when the row has neither flag.
function rowStatus(row: BlogRow): "live" | "off" | "" {
  for (const key of ["is_live", "is_active"]) {
    const value = row[key];
    if (typeof value === "boolean") return value ? "live" : "off";
  }
  return "";
}

export function ArticlesSection({
  isConnected,
  isLoading,
  client,
  articles,
  selectedArticleId,
  columns,
  onSelectArticle,
  onCreateNew,
  onRefresh,
}: ArticlesSectionProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [viewRows, setViewRows] = useState<BlogViewRow[]>([]);
  const [browsers, setBrowsers] = useState<Map<string, BrowserRow>>(new Map());
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsAvailable, setStatsAvailable] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Every setState here runs after an await, so mounting this section never
  // triggers a cascading render. Stale rows from a previous connection are
  // never visible: the whole body is gated on `isConnected` below.
  const loadStats = useCallback(async () => {
    if (!isConnected || !client) return;
    try {
      const rows = await fetchViewRows(client);
      const signatures = Array.from(
        new Set(
          rows
            .map((row) => String(row.browser_signature ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      );
      const browserRows = await fetchBrowsers(client, signatures);
      setViewRows(rows);
      setBrowsers(browserRows);
      setStatsAvailable(true);
      setStatsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load analytics.";
      setViewRows([]);
      setBrowsers(new Map());
      // A missing table is a setup state on that brand's DB, not an error.
      if (/does not exist|schema cache/i.test(message)) {
        setStatsAvailable(false);
      } else {
        setStatsError(message);
      }
    }
  }, [isConnected, client]);

  useEffect(() => {
    if (!isConnected || !client) return;
    // Fetch once per connection, like the other sections do. The rule can't
    // see that every setState in `loadStats` happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStats();
  }, [isConnected, client, loadStats]);

  const analyticsByArticle = useMemo(
    () => computeAnalyticsByArticle(viewRows, browsers),
    [viewRows, browsers],
  );

  const hasStatusFlag = useMemo(
    () => articles.some((article) => rowStatus(article) !== ""),
    [articles],
  );

  const distinctLanguages = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => pickField(article, "language", "lang", "locale"))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const visibleArticles = useMemo(() => {
    return articles.filter((article) => {
      if (statusFilter && rowStatus(article) !== statusFilter) {
        return false;
      }
      if (
        languageFilter &&
        pickField(article, "language", "lang", "locale") !== languageFilter
      ) {
        return false;
      }
      return true;
    });
  }, [articles, statusFilter, languageFilter]);

  const selectedArticle = useMemo(
    () =>
      articles.find(
        (article) => articleOptionValue(article) === selectedArticleId,
      ) ?? null,
    [articles, selectedArticleId],
  );

  // With no article selected, the panel summarises every article at once.
  const panel: { title: string; analytics: BlogAnalytics | null } =
    useMemo(() => {
      if (selectedArticle) {
        const id = String(selectedArticle.id ?? "").trim();
        return {
          title: articleTitle(selectedArticle),
          analytics: analyticsByArticle.get(id) ?? null,
        };
      }
      return {
        title: "All articles",
        analytics:
          viewRows.length > 0 ? computeBlogAnalytics(viewRows, browsers) : null,
      };
    }, [selectedArticle, analyticsByArticle, viewRows, browsers]);

  const handleRefresh = async () => {
    await Promise.all([onRefresh(), loadStats()]);
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={sectionHeaderSx}>
        2. Articles &amp; readership
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect to Supabase first, then you can load, edit and measure blog
          articles.
        </Alert>
      ) : (
        <>
          <Box sx={controlsGridSx}>
            <TextField
              select
              label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={isLoading || !hasStatusFlag}
              fullWidth
            >
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="live">Live / Active</MenuItem>
              <MenuItem value="off">Inactive</MenuItem>
            </TextField>

            <TextField
              select
              label="Filter by language"
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value)}
              disabled={isLoading || distinctLanguages.length === 0}
              fullWidth
            >
              <MenuItem value="">All languages</MenuItem>
              {distinctLanguages.map((language) => (
                <MenuItem key={language} value={language}>
                  {language.toUpperCase()}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="outlined"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="contained"
              onClick={onCreateNew}
              disabled={isLoading}
            >
              Create New
            </Button>
          </Box>

          <Box sx={infoRowSx}>
            <Chip
              label={`${visibleArticles.length}/${articles.length} article(s)`}
              variant="outlined"
            />
            <Chip
              label={`${columns.length} field(s) detected`}
              variant="outlined"
            />
            {statsAvailable && (
              <Chip label={`${viewRows.length} read(s)`} variant="outlined" />
            )}
            {selectedArticleId && (
              <Chip
                label="Clear selection"
                onDelete={() => onSelectArticle("")}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          {statsError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {statsError}
            </Alert>
          )}

          {visibleArticles.length > 0 && (
            <Box sx={scrollRowSx} role="listbox" aria-label="Articles">
              {visibleArticles.map((article) => {
                const value = articleOptionValue(article);
                if (!value) return null;
                return (
                  <ArticleCard
                    key={value}
                    article={article}
                    isSelected={value === selectedArticleId}
                    onSelect={() => onSelectArticle(value)}
                  />
                );
              })}
            </Box>
          )}

          {!isLoading && articles.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Connected, but no rows were returned from table `blog`. Verify
              data exists and anon SELECT policy allows these rows.
            </Alert>
          )}
          {!isLoading &&
            articles.length > 0 &&
            visibleArticles.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No rows match the selected filters.
              </Alert>
            )}

          {statsAvailable ? (
            <Box sx={statsToggleWrapSx}>
              <Button
                onClick={() => setShowStats((open) => !open)}
                startIcon={
                  showStats ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                sx={{ textTransform: "none" }}
                aria-expanded={showStats}
              >
                {showStats ? "Hide" : "Show"} readership · {panel.title}
                {panel.analytics ? ` · ${panel.analytics.readers} read(s)` : ""}
              </Button>
              <Collapse in={showStats} unmountOnExit>
                <ArticleAnalytics
                  title={panel.title}
                  analytics={panel.analytics}
                />
              </Collapse>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 3 }}>
              This database has no <code>{BLOG_VIEWS_TABLE}</code> /{" "}
              <code>{BROWSERS_TABLE}</code> table, so there is nothing to
              measure — see <code>docs/blog-analytics.md</code>.
            </Alert>
          )}
        </>
      )}
    </Paper>
  );
}
