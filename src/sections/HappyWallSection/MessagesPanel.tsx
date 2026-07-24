"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  detectMessageAuthorField,
  detectMessageTextField,
  detectMessageWallFk,
  inferMessageColumns,
  isMultilineMessageField,
} from "@/lib/happyWallSchema";
import {
  actionRowSx,
  groupHeaderSx,
  groupSx,
  sectionPaperSx,
} from "@/sections/TemplateEditorSection/styles";
import { AdaptiveField } from "./AdaptiveField";
import { useAdaptiveTable } from "./useAdaptiveTable";
import type { SelectedWall } from "./WallManagerPanel";

interface MessagesPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  wallTable: string;
  detectedMessageTable: string | null;
  selectedWall: SelectedWall | null;
  onFeedback: (message: string | null) => void;
}

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function MessagesPanel({
  isConnected,
  client,
  environment,
  wallTable,
  detectedMessageTable,
  selectedWall,
  onFeedback,
}: MessagesPanelProps) {
  const [tableOverride, setTableOverride] = useState("");
  const [fkOverride, setFkOverride] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Probe the message table's real schema once, so the editor knows every
  // column (incl. the wall foreign key) even when a wall has zero messages yet.
  const [probeColumns, setProbeColumns] = useState<BlogColumnDefinition[] | null>(
    null,
  );
  const [probeError, setProbeError] = useState<string | null>(null);

  const table = (tableOverride.trim() || detectedMessageTable || "").trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!client || !table) {
        if (!cancelled) {
          setProbeColumns(null);
          setProbeError(null);
        }
        return;
      }
      const { data, error } = await client.from(table).select("*").limit(1);
      if (cancelled) return;
      if (error) {
        setProbeColumns(null);
        setProbeError(error.message || `Could not read ${table}.`);
        return;
      }
      setProbeError(null);
      setProbeColumns(inferMessageColumns((data?.[0] ?? null) as BlogRow | null));
    })();
    return () => {
      cancelled = true;
    };
  }, [client, table]);

  const fkField = useMemo(() => {
    if (fkOverride.trim()) return fkOverride.trim();
    if (!probeColumns) return null;
    return detectMessageWallFk(probeColumns, wallTable);
  }, [fkOverride, probeColumns, wallTable]);

  // Filter value: slug-based FKs use the wall slug, otherwise the numeric id.
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

  // Reload whenever the target wall / table / fk changes. Only fetch once we
  // have a wall to scope to, so we never pull every wall's messages at once.
  useEffect(() => {
    if (!isConnected || !client || !table) return;
    if (!fkField || fkValue === null) return;
    void messages.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client, table, fkField, fkValue]);

  const columns = messages.rows.length > 0 ? messages.columns : probeColumns ?? messages.columns;
  const textField = useMemo(() => detectMessageTextField(columns), [columns]);
  const authorField = useMemo(() => detectMessageAuthorField(columns), [columns]);

  if (!isConnected) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Alert severity="info">Connect to Supabase first.</Alert>
      </Paper>
    );
  }

  if (!detectedMessageTable && !tableOverride.trim()) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Messages
        </Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No message table was auto-detected for this database. Enter the table
          name below (e.g. `happy_wall_message`) to manage its messages.
        </Alert>
        <TextField
          size="small"
          label="Message table name"
          value={tableOverride}
          onChange={(event) => setTableOverride(event.target.value)}
          fullWidth
        />
      </Paper>
    );
  }

  const messageColumns = columns.filter(
    (c) => !fkField || c.name !== fkField || advancedOpen,
  );

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="h6">Messages — moderate</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip size="small" variant="outlined" label={`table: ${table}`} />
          {fkField && (
            <Chip size="small" variant="outlined" label={`link: ${fkField}`} />
          )}
          <Button size="small" onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? "Hide advanced" : "Advanced"}
          </Button>
        </Box>
      </Box>

      <Collapse in={advancedOpen}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            mb: 2,
          }}
        >
          <TextField
            size="small"
            label="Override message table"
            placeholder={detectedMessageTable ?? "happy_wall_message"}
            value={tableOverride}
            onChange={(event) => setTableOverride(event.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label="Override wall FK column"
            placeholder={fkField ?? "wall_id"}
            value={fkOverride}
            onChange={(event) => setFkOverride(event.target.value)}
            fullWidth
          />
        </Box>
      </Collapse>

      {probeError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {probeError}
        </Alert>
      )}
      {messages.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {messages.unavailable}
        </Alert>
      )}

      {!selectedWall ? (
        <Alert severity="info">
          Select a wall in the <strong>Walls</strong> tab to load and moderate
          its messages.
        </Alert>
      ) : !fkField ? (
        <Alert severity="warning">
          Could not detect the column linking messages to a wall on `{table}`.
          Set it under <strong>Advanced → Override wall FK column</strong>.
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
              flexWrap: "wrap",
            }}
          >
            <Chip
              color="primary"
              variant="outlined"
              label={`Wall: ${selectedWall.title}`}
            />
            <Chip
              variant="outlined"
              label={`${messages.rows.length} message(s)`}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => messages.load()}
              disabled={messages.loading}
            >
              {messages.loading ? "Refreshing…" : "Refresh"}
            </Button>
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 340px) 1fr" },
            }}
          >
            {/* Message list */}
            <Stack spacing={1} sx={{ maxHeight: 480, overflowY: "auto", pr: 0.5 }}>
              {messages.rows.length === 0 && !messages.loading && (
                <Alert severity="info">No messages on this wall yet.</Alert>
              )}
              {messages.rows.map((row) => {
                const id = String(row.id ?? "").trim();
                const value = id ? `id:${id}` : "";
                const selected = value === messages.selectedId;
                return (
                  <Paper
                    key={value || Math.random()}
                    variant="outlined"
                    onClick={() => messages.select(value)}
                    sx={{
                      p: 1.25,
                      cursor: "pointer",
                      borderColor: selected ? "primary.main" : "divider",
                      borderWidth: selected ? 2 : 1,
                      bgcolor: selected ? "action.selected" : "background.paper",
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {textField ? str(row[textField]) || "(empty)" : `#${id}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {authorField && str(row[authorField])
                        ? `— ${str(row[authorField])} · `
                        : ""}
                      #{id}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>

            {/* Editor — only for an existing, selected message. */}
            <Box sx={groupSx}>
              <Typography sx={groupHeaderSx}>Edit message</Typography>
              {messages.mode !== "edit" ? (
                <Alert severity="info">
                  Select a message on the left to edit or delete it.
                </Alert>
              ) : (
                <>
                  {messageColumns.map((column) => (
                    <AdaptiveField
                      key={column.name}
                      column={column}
                      value={messages.form[column.name]}
                      multiline={isMultilineMessageField(column)}
                      onChange={(value) =>
                        messages.changeField(column.name, value)
                      }
                    />
                  ))}

                  {messages.error && (
                    <Alert severity="error">{messages.error}</Alert>
                  )}

                  <Divider />
                  <Box sx={actionRowSx}>
                    <Button
                      variant="contained"
                      disabled={messages.submitting}
                      onClick={() => messages.submit("update")}
                    >
                      {messages.submitting ? "Saving…" : "Update"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={messages.submitting}
                      onClick={() => messages.submit("delete")}
                    >
                      Delete
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
}
