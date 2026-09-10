"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DeleteOutlineRounded,
  EditRounded,
  RefreshRounded,
  SaveRounded,
} from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";

// Matches the public.tickets table (tickets_status_check constraint).
export const TICKETS_TABLE = "tickets";

const ROWS_PER_PAGE = 1000;

export type TicketStatus = "open" | "resolved" | "closed";

const STATUS_VALUES: TicketStatus[] = ["open", "resolved", "closed"];

const STATUS_META: Record<
  TicketStatus,
  { label: string; color: "warning" | "success" | "default" }
> = {
  open: { label: "Open", color: "warning" },
  resolved: { label: "Resolved", color: "success" },
  closed: { label: "Closed", color: "default" },
};

type StatusFilter = "all" | TicketStatus;

interface TicketRow {
  id: number;
  browser_signature: string;
  email: string;
  pseudo: string;
  type: string;
  description: string;
  status: string;
  created_at: string | null;
}

interface TicketsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

interface EditDraft {
  pseudo: string;
  type: string;
  description: string;
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function normalizeStatus(status: string): TicketStatus {
  return STATUS_VALUES.includes(status as TicketStatus)
    ? (status as TicketStatus)
    : "open";
}

export function TicketsSection({
  isConnected,
  client,
  environment,
  onFeedback,
}: TicketsSectionProps) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  // Tickets start collapsed; a ticket only shows its details and actions once
  // its id is added here by clicking the card header.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    pseudo: "",
    type: "",
    description: "",
  });

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setUnavailable(null);
    setError(null);
    const all: TicketRow[] = [];
    try {
      // Page through the whole table; PostgREST caps each response at max-rows.
      for (let from = 0; ; from += ROWS_PER_PAGE) {
        const { data, error: queryError } = await client
          .from(TICKETS_TABLE)
          .select(
            "id, browser_signature, email, pseudo, type, description, status, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, from + ROWS_PER_PAGE - 1);
        if (queryError) throw queryError;
        const page = (data ?? []) as TicketRow[];
        all.push(...page);
        if (page.length < ROWS_PER_PAGE) break;
      }
      setRows(all);
    } catch (loadError) {
      setUnavailable(
        readableError(loadError, `Could not load ${TICKETS_TABLE}.`),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!isConnected || !client) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: rows.length,
      open: 0,
      resolved: 0,
      closed: 0,
    };
    rows.forEach((row) => {
      base[normalizeStatus(row.status)] += 1;
    });
    return base;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((row) => normalizeStatus(row.status) === filter),
    [rows, filter],
  );

  const confirmProd = (action: string): boolean => {
    if (environment !== "PROD") return true;
    const answer = window.prompt(
      `PROD action: type PROD to confirm ${action} on the ${TICKETS_TABLE} table.`,
    );
    return answer === "PROD";
  };

  const handleStatusChange = async (ticket: TicketRow, next: TicketStatus) => {
    if (!client) return;
    if (normalizeStatus(ticket.status) === next) return;
    if (!confirmProd(`status change to "${next}"`)) {
      onFeedback("Action cancelled: PROD confirmation not accepted.");
      return;
    }

    setBusyId(ticket.id);
    setError(null);
    try {
      const { data, error: updateError, count } = await client
        .from(TICKETS_TABLE)
        .update({ status: next }, { count: "exact" })
        .eq("id", ticket.id)
        .select("*");
      if (updateError) throw updateError;
      if (count === 0) {
        throw new Error(
          `Update affected 0 rows (ticket #${ticket.id} is gone, or RLS blocks UPDATE for the anon role on ${TICKETS_TABLE}).`,
        );
      }
      const updated = (data?.[0] ?? { ...ticket, status: next }) as TicketRow;
      setRows((previous) =>
        previous.map((row) => (row.id === ticket.id ? updated : row)),
      );
      onFeedback(`Ticket #${ticket.id} marked ${STATUS_META[next].label}.`);
    } catch (statusError) {
      setError(readableError(statusError, "Failed to update ticket status."));
    } finally {
      setBusyId(null);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (ticket: TicketRow) => {
    setEditingId(ticket.id);
    setError(null);
    setEditDraft({
      pseudo: ticket.pseudo ?? "",
      type: ticket.type ?? "",
      description: ticket.description ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ pseudo: "", type: "", description: "" });
  };

  const handleSaveEdit = async (ticket: TicketRow) => {
    if (!client) return;
    if (!confirmProd("edit")) {
      onFeedback("Action cancelled: PROD confirmation not accepted.");
      return;
    }

    setBusyId(ticket.id);
    setError(null);
    try {
      const payload = {
        pseudo: editDraft.pseudo.trim(),
        type: editDraft.type.trim(),
        description: editDraft.description.trim(),
      };
      const { data, error: updateError, count } = await client
        .from(TICKETS_TABLE)
        .update(payload, { count: "exact" })
        .eq("id", ticket.id)
        .select("*");
      if (updateError) throw updateError;
      if (count === 0) {
        throw new Error(
          `Update affected 0 rows (ticket #${ticket.id} is gone, or RLS blocks UPDATE for the anon role on ${TICKETS_TABLE}).`,
        );
      }
      const updated = (data?.[0] ?? { ...ticket, ...payload }) as TicketRow;
      setRows((previous) =>
        previous.map((row) => (row.id === ticket.id ? updated : row)),
      );
      onFeedback(`Ticket #${ticket.id} updated.`);
      cancelEdit();
    } catch (saveError) {
      setError(readableError(saveError, "Failed to update ticket."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (ticket: TicketRow) => {
    if (!client) return;
    if (
      !window.confirm(
        `Delete ticket #${ticket.id} from ${ticket.email || "unknown"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    if (!confirmProd("delete")) {
      onFeedback("Action cancelled: PROD confirmation not accepted.");
      return;
    }

    setBusyId(ticket.id);
    setError(null);
    try {
      const { error: deleteError } = await client
        .from(TICKETS_TABLE)
        .delete()
        .eq("id", ticket.id);
      if (deleteError) throw deleteError;
      setRows((previous) => previous.filter((row) => row.id !== ticket.id));
      if (editingId === ticket.id) cancelEdit();
      onFeedback(`Ticket #${ticket.id} deleted.`);
    } catch (deleteErr) {
      setError(readableError(deleteErr, "Failed to delete ticket."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Tickets · support requests</Typography>
          <Typography variant="body2" color="text.secondary">
            User requests from the <code>{TICKETS_TABLE}</code> table. Change a
            ticket&apos;s status, correct its details, or delete it.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={!isConnected || loading}>
          <RefreshRounded />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!isConnected ? (
        <Alert severity="info">Connect to load support tickets.</Alert>
      ) : unavailable ? (
        <Alert severity="warning">
          Could not load {TICKETS_TABLE}: {unavailable}
        </Alert>
      ) : loading && rows.length === 0 ? (
        <Alert severity="info">Loading tickets…</Alert>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
            {(["all", ...STATUS_VALUES] as StatusFilter[]).map((value) => (
              <Chip
                key={value}
                label={`${value === "all" ? "All" : STATUS_META[value as TicketStatus].label} · ${counts[value]}`}
                color={value === filter ? "primary" : "default"}
                variant={value === filter ? "filled" : "outlined"}
                onClick={() => setFilter(value)}
              />
            ))}
          </Stack>

          {visibleRows.length === 0 ? (
            <Alert severity="info">
              {rows.length === 0
                ? "No tickets recorded yet."
                : "No tickets match this filter."}
            </Alert>
          ) : (
            <Stack spacing={2}>
              {visibleRows.map((ticket) => {
                const status = normalizeStatus(ticket.status);
                const isEditing = editingId === ticket.id;
                const isBusy = busyId === ticket.id;
                const isOpen = expandedIds.has(ticket.id);
                return (
                  <Paper
                    key={ticket.id}
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2 }}
                  >
                    {/* Header stays visible; clicking it expands the ticket
                        to reveal its details and actions. */}
                    <Box
                      onClick={() => toggleExpanded(ticket.id)}
                      role="button"
                      aria-expanded={isOpen}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexWrap: "wrap",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <ExpandMoreIcon
                        sx={{
                          color: "text.secondary",
                          transition: "transform 0.2s",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                      <Chip
                        size="small"
                        label={STATUS_META[status].label}
                        color={STATUS_META[status].color}
                      />
                      <Typography variant="subtitle2">
                        #{ticket.id}
                        {ticket.type ? ` · ${ticket.type}` : ""}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: { xs: "100%", sm: 220 },
                        }}
                      >
                        {ticket.email || "—"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: "auto" }}
                      >
                        {formatDate(ticket.created_at)}
                      </Typography>
                    </Box>

                    <Collapse in={isOpen} unmountOnExit>
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                      {ticket.email || "—"}
                      {ticket.pseudo ? ` · ${ticket.pseudo}` : ""}
                    </Typography>
                    <Tooltip title={ticket.browser_signature || ""}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          mb: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Browser: {ticket.browser_signature || "—"}
                      </Typography>
                    </Tooltip>

                    {isEditing ? (
                      <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                        <TextField
                          label="Pseudo"
                          size="small"
                          value={editDraft.pseudo}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, pseudo: e.target.value }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Type"
                          size="small"
                          value={editDraft.type}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, type: e.target.value }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Description"
                          size="small"
                          value={editDraft.description}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              description: e.target.value,
                            }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Stack>
                    ) : (
                      ticket.description && (
                        <Typography
                          variant="body2"
                          sx={{ mb: 1.5, whiteSpace: "pre-wrap" }}
                        >
                          {ticket.description}
                        </Typography>
                      )
                    )}

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexWrap: "wrap",
                      }}
                    >
                      <TextField
                        select
                        size="small"
                        label="Status"
                        value={status}
                        disabled={isBusy}
                        onChange={(e) =>
                          handleStatusChange(
                            ticket,
                            e.target.value as TicketStatus,
                          )
                        }
                        sx={{ minWidth: 140 }}
                      >
                        {STATUS_VALUES.map((value) => (
                          <MenuItem key={value} value={value}>
                            {STATUS_META[value].label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                        {isEditing ? (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SaveRounded />}
                              disabled={isBusy}
                              onClick={() => handleSaveEdit(ticket)}
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              disabled={isBusy}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditRounded />}
                            disabled={isBusy}
                            onClick={() => startEdit(ticket)}
                          >
                            Correct
                          </Button>
                        )}
                        <IconButton
                          color="error"
                          disabled={isBusy}
                          onClick={() => handleDelete(ticket)}
                          aria-label={`Delete ticket #${ticket.id}`}
                        >
                          <DeleteOutlineRounded />
                        </IconButton>
                      </Box>
                    </Box>
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          )}

          <Box sx={{ mt: 2 }}>
            <Button onClick={load} disabled={loading} variant="outlined">
              Refresh
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
