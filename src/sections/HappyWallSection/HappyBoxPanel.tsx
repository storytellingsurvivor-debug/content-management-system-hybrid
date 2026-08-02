"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  detectMessageAuthorField,
  detectMessageAvatarField,
  detectMessageEmojiField,
  detectMessageMediaField,
  detectMessageTextField,
  detectMessageWallFk,
  inferMessageColumns,
} from "@/lib/happyWallSchema";
import { sectionPaperSx } from "@/sections/TemplateEditorSection/styles";
import { useAdaptiveTable } from "./useAdaptiveTable";
import type { SelectedWall } from "./WallManagerPanel";

interface HappyBoxPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  wallTable: string;
  detectedMessageTable: string | null;
  selectedWall: SelectedWall | null;
  onFeedback: (message: string | null) => void;
}

// Fallback icon so every card carries a friendly mark even when a message has
// neither an emoji nor any media of its own.
const FALLBACK_EMOJI = "💛";

// Card sizes tune the left avatar (emoji/image), the after-text media footprint
// and the name/text type scale.
const CARD_SIZES = {
  small: { avatar: 52, emoji: 32, media: 160, name: 12, message: 12 },
  medium: { avatar: 68, emoji: 42, media: 220, name: 13, message: 14 },
  large: { avatar: 84, emoji: 54, media: 280, name: 15, message: 15 },
} as const;

type CardSize = keyof typeof CARD_SIZES;

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Media is a video when its type hint says so, or its URL ends in a known video
// extension — otherwise it renders as an image.
function isVideoMedia(url: string, typeHint: string): boolean {
  if (/video/i.test(typeHint)) return true;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

export function HappyBoxPanel({
  isConnected,
  client,
  environment,
  wallTable,
  detectedMessageTable,
  selectedWall,
  onFeedback,
}: HappyBoxPanelProps) {
  const [columnsPerRow, setColumnsPerRow] = useState(2);
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [showMessage, setShowMessage] = useState(true);
  const [showName, setShowName] = useState(true);

  const table = (detectedMessageTable ?? "").trim();

  // Probe the message table's real schema once so emoji/media/author columns are
  // known even before any row is inspected.
  const [probeColumns, setProbeColumns] = useState<BlogColumnDefinition[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!client || !table) {
        if (!cancelled) setProbeColumns(null);
        return;
      }
      const { data, error } = await client.from(table).select("*").limit(1);
      if (cancelled) return;
      if (error) {
        setProbeColumns(null);
        return;
      }
      setProbeColumns(inferMessageColumns((data?.[0] ?? null) as BlogRow | null));
    })();
    return () => {
      cancelled = true;
    };
  }, [client, table]);

  const fkField = useMemo(() => {
    if (!probeColumns) return null;
    return detectMessageWallFk(probeColumns, wallTable);
  }, [probeColumns, wallTable]);

  const fkValue = useMemo<string | number | null>(() => {
    if (!fkField || !selectedWall) return null;
    if (/slug/i.test(fkField)) return selectedWall.slug || null;
    const asNumber = Number(selectedWall.id);
    return Number.isNaN(asNumber) ? selectedWall.id : asNumber;
  }, [fkField, selectedWall]);

  const inferColumns = useCallback(
    (row: BlogRow | null) =>
      row ? inferMessageColumns(row) : probeColumns ?? inferMessageColumns(null),
    [probeColumns],
  );

  const messages = useAdaptiveTable({
    client,
    table: table || "__none__",
    label: "Message",
    inferColumns,
    filter: fkField && fkValue !== null ? { field: fkField, value: fkValue } : null,
    environment,
    onFeedback,
  });

  useEffect(() => {
    if (!isConnected || !client || !table) return;
    if (!fkField || fkValue === null) return;
    void messages.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client, table, fkField, fkValue]);

  const columns =
    messages.rows.length > 0 ? messages.columns : probeColumns ?? messages.columns;
  const textField = useMemo(() => detectMessageTextField(columns), [columns]);
  const authorField = useMemo(() => detectMessageAuthorField(columns), [columns]);
  const emojiField = useMemo(() => detectMessageEmojiField(columns), [columns]);
  // The writer's avatar image (left), kept separate from the media content
  // attached to the message (right).
  const avatarField = useMemo(() => detectMessageAvatarField(columns), [columns]);
  const mediaSpec = useMemo(() => detectMessageMediaField(columns), [columns]);

  const size = CARD_SIZES[cardSize];

  if (!isConnected) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Alert severity="info">Connect to Supabase first.</Alert>
      </Paper>
    );
  }

  if (!detectedMessageTable) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Happy Box
        </Typography>
        <Alert severity="warning">
          No message table was auto-detected for this database, so there are no
          messages to lay out. Open the <strong>Walls</strong> tab first — once
          messages load there, the Happy Box grid will pick them up too.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6">Happy Box — message grid</Typography>
        <Typography variant="body2" color="text.secondary">
          Every message of the selected wall as a card — the writer&apos;s emoji
          or photo and name on the left, their message (with any image or video)
          on the right — ready to drop into a PDF or Canva and build the Happy
          Box.
        </Typography>
      </Box>

      {messages.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {messages.unavailable}
        </Alert>
      )}

      {!selectedWall ? (
        <Alert severity="info">
          Select a wall in the <strong>Walls</strong> tab to lay out its messages
          as a grid.
        </Alert>
      ) : !fkField ? (
        <Alert severity="warning">
          Could not detect the column linking messages to a wall on `{table}`.
          Load the wall&apos;s messages under the <strong>Walls</strong> tab
          first.
        </Alert>
      ) : (
        <>
          {/* Layout controls */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 2,
              flexWrap: "wrap",
            }}
          >
            <Chip
              color="primary"
              variant="outlined"
              label={`Wall: ${selectedWall.title}`}
            />
            <Chip variant="outlined" label={`${messages.rows.length} card(s)`} />
            <Button
              size="small"
              variant="outlined"
              onClick={() => messages.load()}
              disabled={messages.loading}
            >
              {messages.loading ? "Refreshing…" : "Refresh"}
            </Button>

            <Box sx={{ flex: 1 }} />

            <TextField
              select
              size="small"
              label="Columns"
              value={columnsPerRow}
              onChange={(event) => setColumnsPerRow(Number(event.target.value))}
              sx={{ width: 110 }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <MenuItem key={n} value={n}>
                  {n} / row
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Card size"
              value={cardSize}
              onChange={(event) => setCardSize(event.target.value as CardSize)}
              sx={{ width: 130 }}
            >
              <MenuItem value="small">Small</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="large">Large</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={showName}
                  onChange={(event) => setShowName(event.target.checked)}
                />
              }
              label="Name"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showMessage}
                  onChange={(event) => setShowMessage(event.target.checked)}
                />
              }
              label="Message"
            />
          </Box>

          {messages.rows.length === 0 && !messages.loading ? (
            <Alert severity="info">
              No messages on this wall yet — nothing to lay out.
            </Alert>
          ) : (
            <Box>
              <Typography
                variant="h6"
                sx={{ mb: 2, textAlign: "center", fontWeight: 700 }}
              >
                {selectedWall.title}
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                  },
                }}
              >
                {messages.rows.map((row) => {
                  const id = str(row.id);
                  const emoji = emojiField ? str(row[emojiField]) : "";
                  const name = authorField ? str(row[authorField]) : "";
                  const message = textField ? str(row[textField]) : "";

                  // Left = the writer's avatar: emoji first, else their image.
                  const avatarUrl = avatarField ? str(row[avatarField]) : "";
                  const showAvatarImage = !emoji && isHttpUrl(avatarUrl);

                  // Right = the media content attached to the message (never the
                  // writer's avatar image).
                  const mediaUrl = mediaSpec ? str(row[mediaSpec.url]) : "";
                  const mediaTypeHint =
                    mediaSpec?.type ? str(row[mediaSpec.type]) : "";
                  const hasMedia =
                    isHttpUrl(mediaUrl) && mediaUrl !== avatarUrl;
                  const mediaIsVideo = hasMedia && isVideoMedia(mediaUrl, mediaTypeHint);

                  const hasRight = (showMessage && Boolean(message)) || hasMedia;

                  return (
                    <Box
                      key={id || Math.random()}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                        bgcolor: "background.paper",
                      }}
                    >
                      {/* Left column: emoji or writer image, with the name below. */}
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: size.avatar,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        {showAvatarImage ? (
                          <Box
                            component="img"
                            src={avatarUrl}
                            alt={name || "Message author"}
                            sx={{
                              width: "100%",
                              aspectRatio: "1",
                              objectFit: "cover",
                              borderRadius: 2,
                            }}
                          />
                        ) : (
                          <Box sx={{ fontSize: size.emoji, lineHeight: 1 }}>
                            {emoji || FALLBACK_EMOJI}
                          </Box>
                        )}

                        {showName && name && (
                          <Typography
                            sx={{
                              fontSize: size.name,
                              fontWeight: 700,
                              color: "text.secondary",
                              textAlign: "center",
                              wordBreak: "break-word",
                            }}
                          >
                            {name}
                          </Typography>
                        )}
                      </Box>

                      {/* Right column: the message text, then its media content. */}
                      {hasRight && (
                        <Box
                          sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          {showMessage && message && (
                            <Typography
                              sx={{
                                fontSize: size.message,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                color: "text.primary",
                              }}
                            >
                              {message}
                            </Typography>
                          )}

                          {hasMedia &&
                            (mediaIsVideo ? (
                              <Box
                                component="video"
                                src={mediaUrl}
                                controls
                                preload="metadata"
                                sx={{
                                  width: "100%",
                                  maxWidth: size.media,
                                  borderRadius: 2,
                                  bgcolor: "common.black",
                                }}
                              />
                            ) : (
                              <Box
                                component="img"
                                src={mediaUrl}
                                alt={name ? `Media from ${name}` : "Message media"}
                                sx={{
                                  width: "100%",
                                  maxWidth: size.media,
                                  borderRadius: 2,
                                  objectFit: "cover",
                                }}
                              />
                            ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
