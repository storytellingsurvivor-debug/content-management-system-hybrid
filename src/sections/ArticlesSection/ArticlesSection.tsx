"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import {
  controlsGridSx,
  infoRowSx,
  sectionHeaderSx,
  sectionPaperSx,
} from "./styles";

interface ArticlesSectionProps {
  isConnected: boolean;
  isLoading: boolean;
  articles: BlogRow[];
  selectedArticleId: string;
  columns: BlogColumnDefinition[];
  onSelectArticle: (value: string) => void;
  onCreateNew: () => void;
  onRefresh: () => void;
  x;
}

function articleOptionLabel(row: BlogRow): string {
  const slug = String(row.slug ?? "").trim();
  const id = String(row.id ?? "").trim();
  if (slug && id) return `${slug} (#${id})`;
  if (slug) return slug;
  if (id) return `Article #${id}`;
  return "Untitled article";
}

function articleOptionValue(row: BlogRow): string {
  const id = String(row.id ?? "").trim();
  if (id) return `id:${id}`;
  const slug = String(row.slug ?? "").trim();
  return slug ? `slug:${slug}` : "";
}

export function ArticlesSection({
  isConnected,
  isLoading,
  articles,
  selectedArticleId,
  columns,
  onSelectArticle,
  onCreateNew,
  onRefresh,
}: ArticlesSectionProps) {
  const [brandFilter, setBrandFilter] = useState<string>("");

  const distinctBrands = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => String(article.brand ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const visibleArticles = useMemo(() => {
    if (!brandFilter) return articles;
    return articles.filter(
      (article) => String(article.brand ?? "").trim() === brandFilter,
    );
  }, [articles, brandFilter]);

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={sectionHeaderSx}>
        2. Articles
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect to Supabase first, then you can load and select blog articles.
        </Alert>
      ) : (
        <>
          <Box sx={controlsGridSx}>
            <TextField
              select
              label="Filter by brand"
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              disabled={isLoading || distinctBrands.length === 0}
              fullWidth
            >
              <MenuItem value="">All brands</MenuItem>
              {distinctBrands.map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Existing article"
              value={selectedArticleId}
              onChange={(event) => onSelectArticle(event.target.value)}
              disabled={isLoading || visibleArticles.length === 0}
              fullWidth
            >
              <MenuItem value="">No article selected</MenuItem>
              {visibleArticles.map((article) => {
                const value = articleOptionValue(article);
                if (!value) return null;
                return (
                  <MenuItem key={value} value={value}>
                    {articleOptionLabel(article)}
                  </MenuItem>
                );
              })}
            </TextField>

            <Button variant="outlined" onClick={onRefresh} disabled={isLoading}>
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
          </Box>

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
                No rows match the selected brand filter.
              </Alert>
            )}
        </>
      )}
    </Paper>
  );
}
