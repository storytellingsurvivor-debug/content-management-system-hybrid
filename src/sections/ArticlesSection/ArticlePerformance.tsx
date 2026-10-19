"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import type { BlogRow } from "@/types/blog";
import type { BlogViewRow, BrowserRow } from "@/lib/blogAnalytics";
import {
  DORMANT_AFTER_DAYS,
  HEALTH_ORDER,
  NEW_ARTICLE_DAYS,
  computeArticlePerformance,
  computeCategoryPerformance,
  performanceToCsv,
  type ArticleHealth,
  type ArticlePerformance as ArticlePerf,
} from "@/lib/articlePerformance";
import { KpiTile } from "./ArticleAnalytics";
import { kpiGridSx, perfTableWrapSx, statsPanelSx } from "./styles";

interface ArticlePerformanceProps {
  articles: BlogRow[]; // already filtered by status / language / category
  viewRows: BlogViewRow[];
  browsers: Map<string, BrowserRow>;
  onSelectArticle: (id: string) => void;
}

const HEALTH_META: Record<
  ArticleHealth,
  {
    label: string;
    color: "success" | "info" | "default" | "secondary" | "warning" | "error";
    hint: string;
  }
> = {
  top: {
    label: "Top",
    color: "success",
    hint: "Top 25% by reads per week",
  },
  rising: {
    label: "Rising",
    color: "info",
    hint: "Last 30 days ≥ 1.5× the 30 days before",
  },
  steady: { label: "Steady", color: "default", hint: "Read regularly" },
  new: {
    label: "New",
    color: "secondary",
    hint: `Online for less than ${NEW_ARTICLE_DAYS} days — too early to judge`,
  },
  fading: {
    label: "Fading",
    color: "warning",
    hint: "Last 30 days ≤ half of the 30 days before",
  },
  dormant: {
    label: "Dormant",
    color: "error",
    hint: `No human read for ${DORMANT_AFTER_DAYS}+ days (or never)`,
  },
};

type SortKey =
  | "readsPerWeek"
  | "reads"
  | "readsLast30Days"
  | "trendPercent"
  | "ageDays"
  | "daysSinceLastRead"
  | "likes";

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
  {
    key: "readsPerWeek",
    label: "Reads / week",
    hint: "Reads divided by weeks online — fair to old and new articles",
  },
  { key: "reads", label: "Reads", hint: "All-time human reads" },
  {
    key: "readsLast30Days",
    label: "30 days",
    hint: "Reads in the last 30 days",
  },
  {
    key: "trendPercent",
    label: "Trend",
    hint: "Last 30 days vs the 30 days before",
  },
  {
    key: "ageDays",
    label: "Online",
    hint: "Days since publication (published_at or created_at)",
  },
  {
    key: "daysSinceLastRead",
    label: "Last read",
    hint: "Days since the latest human read",
  },
  { key: "likes", label: "Likes", hint: "has_liked = true" },
];

// Missing values (never read, no baseline…) always sort last.
function sortValue(a: ArticlePerf, key: SortKey): number | null {
  return a[key];
}

function formatDays(days: number | null, never = "—"): string {
  if (days == null) return never;
  if (days === 0) return "today";
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${Math.round((days / 365) * 10) / 10} y`;
}

function downloadCsv(rows: ArticlePerf[]) {
  const blob = new Blob([performanceToCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `article-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ArticlePerformance({
  articles,
  viewRows,
  browsers,
  onSelectArticle,
}: ArticlePerformanceProps) {
  const [sortKey, setSortKey] = useState<SortKey>("readsPerWeek");
  const [sortDesc, setSortDesc] = useState(true);
  const [healthFilter, setHealthFilter] = useState<ArticleHealth | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const perf = useMemo(
    () => computeArticlePerformance(articles, viewRows, browsers),
    [articles, viewRows, browsers],
  );
  const categories = useMemo(() => computeCategoryPerformance(perf), [perf]);

  const healthCounts = useMemo(() => {
    const counts = new Map<ArticleHealth, number>();
    for (const a of perf) counts.set(a.health, (counts.get(a.health) ?? 0) + 1);
    return counts;
  }, [perf]);

  const ranked = useMemo(() => {
    const filtered = perf.filter(
      (a) =>
        (!healthFilter || a.health === healthFilter) &&
        (!categoryFilter || a.category === categoryFilter),
    );
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDesc ? vb - va : va - vb;
    });
  }, [perf, healthFilter, categoryFilter, sortKey, sortDesc]);

  if (perf.length === 0) {
    return (
      <Box sx={statsPanelSx}>
        <Alert severity="info">No articles match the current filters.</Alert>
      </Box>
    );
  }

  const totalReads = perf.reduce((sum, a) => sum + a.reads, 0);
  const reads30 = perf.reduce((sum, a) => sum + a.readsLast30Days, 0);
  const dormantLive = perf.filter(
    (a) => a.health === "dormant" && a.isLive !== false,
  ).length;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <Box sx={statsPanelSx}>
      <Box sx={kpiGridSx}>
        <KpiTile label="Articles" value={perf.length} />
        <KpiTile label="Reads (all time)" value={totalReads} />
        <KpiTile label="Reads · last 30 days" value={reads30} />
        <KpiTile
          label="Reads per article"
          value={Math.round((totalReads / perf.length) * 10) / 10}
        />
        <KpiTile label="Live but dormant" value={dormantLive} />
      </Box>

      <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip
          label={`All (${perf.length})`}
          color="primary"
          variant={healthFilter === "" ? "filled" : "outlined"}
          onClick={() => setHealthFilter("")}
        />
        {HEALTH_ORDER.map((health) => {
          const meta = HEALTH_META[health];
          const count = healthCounts.get(health) ?? 0;
          return (
            <Tooltip key={health} title={meta.hint}>
              <Chip
                label={`${meta.label} (${count})`}
                color={meta.color}
                variant={healthFilter === health ? "filled" : "outlined"}
                onClick={() =>
                  setHealthFilter((current) =>
                    current === health ? "" : health,
                  )
                }
                disabled={count === 0}
              />
            </Tooltip>
          );
        })}
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        By category
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={perfTableWrapSx}>
        <Table size="small" stickyHeader aria-label="Performance by category">
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Articles</TableCell>
              <TableCell align="right">Live</TableCell>
              <TableCell align="right">Reads</TableCell>
              <TableCell align="right">Reads / article</TableCell>
              <TableCell align="right">Reads / week</TableCell>
              <TableCell align="right">30 days</TableCell>
              <TableCell align="right">Dormant</TableCell>
              <TableCell>Best article</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((c) => (
              <TableRow
                key={c.category}
                hover
                selected={c.category === categoryFilter}
                onClick={() =>
                  setCategoryFilter((current) =>
                    current === c.category ? "" : c.category,
                  )
                }
                sx={{ cursor: "pointer" }}
              >
                <TableCell>{c.category}</TableCell>
                <TableCell align="right">{c.articles}</TableCell>
                <TableCell align="right">{c.liveArticles}</TableCell>
                <TableCell align="right">{c.reads}</TableCell>
                <TableCell align="right">{c.readsPerArticle}</TableCell>
                <TableCell align="right">{c.readsPerWeek}</TableCell>
                <TableCell align="right">{c.readsLast30Days}</TableCell>
                <TableCell
                  align="right"
                  sx={{ color: c.dormant > 0 ? "error.main" : undefined }}
                >
                  {c.dormant}
                </TableCell>
                <TableCell
                  sx={{
                    maxWidth: 260,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={c.best?.title}
                >
                  {c.best && c.best.reads > 0
                    ? `${c.best.title} (${c.best.reads})`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          mt: 3,
          mb: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="subtitle2">
          Ranking · {ranked.length} article(s)
        </Typography>
        {categoryFilter && (
          <Chip
            size="small"
            label={categoryFilter}
            onDelete={() => setCategoryFilter("")}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadCsv(ranked)}
          disabled={ranked.length === 0}
        >
          Export CSV
        </Button>
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={perfTableWrapSx}>
        <Table size="small" stickyHeader aria-label="Article ranking">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Article</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Health</TableCell>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  align="right"
                  sortDirection={
                    sortKey === col.key ? (sortDesc ? "desc" : "asc") : false
                  }
                >
                  <Tooltip title={col.hint}>
                    <TableSortLabel
                      active={sortKey === col.key}
                      direction={
                        sortKey === col.key && !sortDesc ? "asc" : "desc"
                      }
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ranked.map((a, index) => {
              const meta = HEALTH_META[a.health];
              return (
                <TableRow
                  key={a.id}
                  hover
                  onClick={() => onSelectArticle(a.id)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 320,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={a.title}
                  >
                    {a.isLive === false && (
                      <Chip
                        label="off"
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.75 }}
                      />
                    )}
                    {a.language && (
                      <Box
                        component="span"
                        sx={{ color: "text.secondary", mr: 0.75 }}
                      >
                        {a.language.toUpperCase()}
                      </Box>
                    )}
                    {a.title}
                  </TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell>
                    <Tooltip title={meta.hint}>
                      <Chip
                        label={meta.label}
                        color={meta.color}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{a.readsPerWeek}</TableCell>
                  <TableCell align="right">{a.reads}</TableCell>
                  <TableCell align="right">{a.readsLast30Days}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        a.trendPercent == null
                          ? "text.secondary"
                          : a.trendPercent >= 0
                            ? "success.main"
                            : "error.main",
                    }}
                  >
                    {a.trendPercent == null
                      ? "—"
                      : `${a.trendPercent > 0 ? "+" : ""}${a.trendPercent}%`}
                  </TableCell>
                  <TableCell align="right">{formatDays(a.ageDays)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        a.daysSinceLastRead == null ||
                        a.daysSinceLastRead >= DORMANT_AFTER_DAYS
                          ? "error.main"
                          : undefined,
                    }}
                  >
                    {formatDays(a.daysSinceLastRead, "never")}
                  </TableCell>
                  <TableCell align="right">{a.likes}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: "block" }}
      >
        Robots &amp; bots excluded · one read = one browser per article · click
        a row to open the article · follows the status / language / category
        filters above.
      </Typography>
    </Box>
  );
}
