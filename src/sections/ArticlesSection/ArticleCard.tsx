"use client";

import { Box, Card, CardActionArea, Chip, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import ArticleIcon from "@mui/icons-material/Article";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
import type { BlogRow } from "@/types/blog";
import {
  cardBodySx,
  cardChipsRowSx,
  cardLiveBadgeSx,
  cardMediaWrapSx,
  cardMetaRowSx,
  cardSelectedSx,
  cardSx,
  cardTitleSx,
} from "./styles";

interface ArticleCardProps {
  article: BlogRow;
  isSelected: boolean;
  onSelect: () => void;
}

function pickString(row: BlogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

const COVER_KEYS = [
  "cover_url",
  "background_cover",
  "background_cover_url",
  "background_image",
  "background_image_url",
  "cover_image",
  "cover_image_url",
  "image_url",
];

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function pickCoverUrl(row: BlogRow): string {
  for (const key of COVER_KEYS) {
    const raw = String(row[key] ?? "").trim();
    if (isHttpUrl(raw)) return raw;
  }
  return "";
}

function pickReadMinutes(row: BlogRow): string {
  const value = row.read_in_minutes;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return "";
}

export function ArticleCard({
  article,
  isSelected,
  onSelect,
}: ArticleCardProps) {
  const live = article.is_live === true;
  const title = pickString(article, "title", "slug") || "Untitled article";
  const slug = pickString(article, "slug");
  const brand = pickString(article, "brand");
  const language = pickString(article, "language", "lang", "locale");
  const category = pickString(article, "category");
  const author = pickString(article, "author_name", "author");
  const cover = pickCoverUrl(article);
  const readMinutes = pickReadMinutes(article);
  const idLabel = String(article.id ?? "").trim();

  return (
    <Card
      elevation={2}
      sx={
        [cardSx, isSelected ? cardSelectedSx : null].filter(
          Boolean,
        ) as SxProps<Theme>
      }
      aria-selected={isSelected}
    >
      <CardActionArea
        onClick={onSelect}
        sx={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <Box sx={cardMediaWrapSx}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.disabled",
              }}
            >
              <ArticleIcon fontSize="large" />
            </Box>
          )}
          <Box sx={cardLiveBadgeSx}>
            {live ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 14, color: "#7CFFAA" }} />
                <Box component="span">Live</Box>
              </>
            ) : (
              <>
                <RemoveCircleOutlineIcon
                  sx={{ fontSize: 14, color: "#FFB4B4" }}
                />
                <Box component="span">Draft</Box>
              </>
            )}
          </Box>
        </Box>

        <Box sx={cardBodySx}>
          <Box sx={cardChipsRowSx}>
            {brand && (
              <Chip
                label={brand}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {language && (
              <Chip label={language.toUpperCase()} size="small" />
            )}
            {category && (
              <Chip label={category} size="small" variant="outlined" />
            )}
          </Box>

          <Typography sx={cardTitleSx} title={title}>
            {title}
          </Typography>

          {slug && slug !== title && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              title={slug}
            >
              /{slug}
            </Typography>
          )}

          <Box sx={cardMetaRowSx}>
            {author && (
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={author}
                >
                  {author}
                </Box>
              </Box>
            )}
            {readMinutes && (
              <Box component="span">{readMinutes} min</Box>
            )}
            {idLabel && (
              <Box component="span" sx={{ color: "text.disabled" }}>
                #{idLabel}
              </Box>
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
