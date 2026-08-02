"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  GlobalStyles,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import PrintRounded from "@mui/icons-material/PrintRounded";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  detectMessageAuthorField,
  detectMessageEmojiField,
  detectMessageImageField,
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
// neither an emoji nor an image of its own.
const FALLBACK_EMOJI = "💛";

// Card sizes tune both the tile footprint and how big the emoji/text read on
// paper — "Large" prints ~6 to a page, "Small" packs many more.
const CARD_SIZES = {
  small: { minWidth: 150, emoji: 40, image: 84, name: 12, message: 12 },
  medium: { minWidth: 200, emoji: 56, image: 120, name: 14, message: 14 },
  large: { minWidth: 260, emoji: 76, image: 168, name: 16, message: 16 },
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

// Print rules: hide the whole app while printing and reveal only the grid, so a
// browser "Save as PDF" produces clean pages of cut-out cards.
const printStyles = (
  <GlobalStyles
    styles={{
      "@media print": {
        "body *": { visibility: "hidden" },
        ".happy-box-print-area, .happy-box-print-area *": {
          visibility: "visible",
        },
        ".happy-box-print-area": {
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
        },
        ".happy-box-no-print": { display: "none !important" },
        ".happy-box-card": {
          breakInside: "avoid",
          pageBreakInside: "avoid",
          boxShadow: "none",
        },
        "@page": { margin: "12mm" },
      },
    }}
  />
);

export function HappyBoxPanel({
  isConnected,
  client,
  environment,
  wallTable,
  detectedMessageTable,
  selectedWall,
  onFeedback,
}: HappyBoxPanelProps) {
  const [columnsPerRow, setColumnsPerRow] = useState(3);
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [showMessage, setShowMessage] = useState(true);
  const [showName, setShowName] = useState(true);
  const [cutGuides, setCutGuides] = useState(true);

  const table = (detectedMessageTable ?? "").trim();

  // Probe the message table's real schema once so emoji/image/author columns are
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
  const imageField = useMemo(() => detectMessageImageField(columns), [columns]);

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
      {printStyles}

      <Box
        className="happy-box-no-print"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          mb: 1,
        }}
      >
        <Box>
          <Typography variant="h6">Happy Box — printable grid</Typography>
          <Typography variant="body2" color="text.secondary">
            Every message of the selected wall as a card you can print, drop into
            a PDF or Canva, then cut &amp; glue to build the Happy Box.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PrintRounded />}
          onClick={() => window.print()}
          disabled={messages.rows.length === 0}
        >
          Print / Save as PDF
        </Button>
      </Box>

      {messages.unavailable && (
        <Alert severity="warning" className="happy-box-no-print" sx={{ mb: 2 }}>
          {messages.unavailable}
        </Alert>
      )}

      {!selectedWall ? (
        <Alert severity="info" className="happy-box-no-print">
          Select a wall in the <strong>Walls</strong> tab to lay out its messages
          as a printable grid.
        </Alert>
      ) : !fkField ? (
        <Alert severity="warning" className="happy-box-no-print">
          Could not detect the column linking messages to a wall on `{table}`.
          Load the wall&apos;s messages under the <strong>Walls</strong> tab
          first.
        </Alert>
      ) : (
        <>
          {/* Layout controls — hidden from the printout. */}
          <Box
            className="happy-box-no-print"
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
            <FormControlLabel
              control={
                <Switch
                  checked={cutGuides}
                  onChange={(event) => setCutGuides(event.target.checked)}
                />
              }
              label="Cut guides"
            />
          </Box>

          {messages.rows.length === 0 && !messages.loading ? (
            <Alert severity="info" className="happy-box-no-print">
              No messages on this wall yet — nothing to lay out.
            </Alert>
          ) : (
            <Box className="happy-box-print-area">
              <Typography
                variant="h6"
                sx={{ mb: 2, textAlign: "center", fontWeight: 700 }}
              >
                {selectedWall.title}
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gap: cutGuides ? 1.5 : 2,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                  },
                }}
              >
                {messages.rows.map((row) => {
                  const id = str(row.id);
                  const emoji = emojiField ? str(row[emojiField]) : "";
                  const imageUrl = imageField ? str(row[imageField]) : "";
                  const hasImage = isHttpUrl(imageUrl);
                  const name = authorField ? str(row[authorField]) : "";
                  const message = textField ? str(row[textField]) : "";

                  return (
                    <Box
                      key={id || Math.random()}
                      className="happy-box-card"
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: 1,
                        p: 1.5,
                        minHeight: size.minWidth,
                        borderRadius: 2,
                        border: (theme) =>
                          cutGuides
                            ? `1px dashed ${theme.palette.text.disabled}`
                            : `1px solid ${theme.palette.divider}`,
                        bgcolor: "background.paper",
                        justifyContent: "center",
                      }}
                    >
                      {hasImage ? (
                        <Box
                          component="img"
                          src={imageUrl}
                          alt={name || "Happy message"}
                          sx={{
                            width: size.image,
                            height: size.image,
                            objectFit: "cover",
                            borderRadius: 2,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            fontSize: size.emoji,
                            lineHeight: 1,
                          }}
                        >
                          {emoji || FALLBACK_EMOJI}
                        </Box>
                      )}

                      {showMessage && message && (
                        <Typography
                          sx={{
                            fontSize: size.message,
                            whiteSpace: "pre-wrap",
                            fontStyle: "italic",
                            color: "text.primary",
                          }}
                        >
                          “{message}”
                        </Typography>
                      )}

                      {showName && name && (
                        <Typography
                          sx={{
                            fontSize: size.name,
                            fontWeight: 700,
                            color: "text.secondary",
                          }}
                        >
                          — {name}
                        </Typography>
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
