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
import { ArticleCard } from "./ArticleCard";
import {
  controlsGridSx,
  infoRowSx,
  scrollRowSx,
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
  onRefresh: () => void | Promise<void>;
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
  const [languageFilter, setLanguageFilter] = useState<string>("");

  const distinctBrands = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => pickField(article, "brand"))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [articles]);

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
      if (
        brandFilter &&
        pickField(article, "brand") !== brandFilter
      ) {
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
  }, [articles, brandFilter, languageFilter]);

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
            {selectedArticleId && (
              <Chip
                label="Clear selection"
                onDelete={() => onSelectArticle("")}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

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
        </>
      )}
    </Paper>
  );
}
