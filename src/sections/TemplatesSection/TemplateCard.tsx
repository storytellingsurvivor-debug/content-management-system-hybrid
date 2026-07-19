"use client";

import { Box, Card, CardActionArea, Chip, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import LayersIcon from "@mui/icons-material/Layers";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
import type { BlogRow } from "@/types/blog";
import {
  cardBodySx,
  cardChipsRowSx,
  cardMediaWrapSx,
  cardMetaRowSx,
  cardSelectedSx,
  cardStatusBadgeSx,
  cardSx,
  cardTitleSx,
} from "./styles";

interface TemplateCardProps {
  template: BlogRow;
  isSelected: boolean;
  onSelect: () => void;
  // Resolved by the caller for tables whose display values live in another row
  // (a spot's image and note sit on its main tag). Each falls back to the keys
  // found on the row itself.
  coverUrl?: string | null;
  subtitleOverride?: string | null;
}

const COVER_KEYS = [
  "uploaded_image_url",
  "cover_url",
  "background_cover_url",
  "background_cover",
  "background_image_url",
  "background_image",
  "cover_image_url",
  "cover_image",
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

function pickString(row: BlogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function pickCoverUrl(row: BlogRow): string {
  for (const key of COVER_KEYS) {
    const raw = String(row[key] ?? "").trim();
    if (isHttpUrl(raw)) return raw;
  }
  return "";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TemplateCard({
  template,
  isSelected,
  onSelect,
  coverUrl,
  subtitleOverride,
}: TemplateCardProps) {
  const active = template.is_active !== false;
  const title =
    pickString(template, "hero_title", "name", "metadata_title", "slug") ||
    "Untitled template";
  const slug = pickString(template, "slug");
  const brand = pickString(template, "brand");
  const language = pickString(template, "language", "lang", "locale");
  const subtitle =
    subtitleOverride || pickString(template, "hero_subtitle", "description");
  const cover = coverUrl || pickCoverUrl(template);
  const coverColor = pickString(template, "color", "background_color");
  const emoji = pickString(template, "emoji");
  const createdAt = formatDate(template.created_at);
  const idLabel = String(template.id ?? "").trim();

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
        <Box
          sx={cardMediaWrapSx}
          style={!cover && coverColor ? { backgroundColor: coverColor } : undefined}
        >
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
          ) : coverColor ? (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                lineHeight: 1,
              }}
            >
              {emoji}
            </Box>
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
              <LayersIcon fontSize="large" />
            </Box>
          )}
          <Box sx={cardStatusBadgeSx}>
            {active ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 14, color: "#7CFFAA" }} />
                <Box component="span">Active</Box>
              </>
            ) : (
              <>
                <RemoveCircleOutlineIcon
                  sx={{ fontSize: 14, color: "#FFB4B4" }}
                />
                <Box component="span">Inactive</Box>
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
          </Box>

          <Typography sx={cardTitleSx} title={title}>
            {title}
          </Typography>

          {slug && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              title={slug}
            >
              /{slug}
            </Typography>
          )}

          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              title={subtitle}
            >
              {subtitle}
            </Typography>
          )}

          <Box sx={cardMetaRowSx}>
            {createdAt && <Box component="span">{createdAt}</Box>}
            {idLabel && (
              <Box component="span" sx={{ ml: "auto", color: "text.disabled" }}>
                #{idLabel}
              </Box>
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
