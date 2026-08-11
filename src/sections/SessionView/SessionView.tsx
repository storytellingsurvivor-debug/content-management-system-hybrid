"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import type {
  SessionStatus,
  TwitchSessionEventRow,
  TwitchSessionRow,
} from "@/types/twitchBot";

const POLL_INTERVAL_MS = 2500;

const STATUS_COLORS: Record<
  SessionStatus,
  "default" | "info" | "success" | "warning" | "error"
> = {
  idle: "default",
  connecting: "info",
  connected: "success",
  disconnected: "warning",
  error: "error",
};

interface SessionData {
  session: TwitchSessionRow;
  channel: { name: string; twitch_channel: string };
  events: TwitchSessionEventRow[];
}

interface SessionViewProps {
  token: string;
}

export function SessionView({ token }: SessionViewProps) {
  const [data, setData] = useState<SessionData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [triggerDraft, setTriggerDraft] = useState("");
  const [isEditingTrigger, setIsEditingTrigger] = useState(false);
  const [isSavingTrigger, setIsSavingTrigger] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isEditingRef = useRef(false);
  isEditingRef.current = isEditingTrigger;

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const res = await fetch(`/api/twitch/sessions/${token}`);
      if (cancelled) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as SessionData;
      setData(next);
      if (!isEditingRef.current) setTriggerDraft(next.session.trigger_command);
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  const saveTrigger = async () => {
    setIsSavingTrigger(true);
    try {
      await fetch(`/api/twitch/sessions/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_command: triggerDraft }),
      });
      setIsEditingTrigger(false);
    } finally {
      setIsSavingTrigger(false);
    }
  };

  const requestDisconnect = async () => {
    await fetch(`/api/twitch/sessions/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disconnect_requested: true }),
    });
  };

  const deleteEvent = async (eventId: number) => {
    setDeleteError(null);
    const res = await fetch(
      `/api/twitch/sessions/${token}/events/${eventId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? "Could not delete this message.");
      return;
    }
    setData((prev) =>
      prev
        ? { ...prev, events: prev.events.filter((e) => e.id !== eventId) }
        : prev,
    );
  };

  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h6">Session not found.</Typography>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Container>
    );
  }

  const { session, channel, events } = data;

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Typography variant="h5">#{channel.twitch_channel}</Typography>
          <Chip label={session.status} color={STATUS_COLORS[session.status]} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {channel.name}
        </Typography>

        {session.status_detail && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {session.status_detail}
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "center" }}>
          <TextField
            label="Trigger command"
            size="small"
            value={triggerDraft}
            onChange={(e) => {
              setIsEditingTrigger(true);
              setTriggerDraft(e.target.value);
            }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={
              !isEditingTrigger ||
              isSavingTrigger ||
              triggerDraft.trim() === session.trigger_command
            }
            onClick={saveTrigger}
          >
            {isSavingTrigger ? "Saving..." : "Save"}
          </Button>
        </Stack>

        <Button
          variant="outlined"
          color="error"
          disabled={
            session.disconnect_requested ||
            (session.status !== "connected" && session.status !== "connecting")
          }
          onClick={requestDisconnect}
          sx={{ mb: 3 }}
        >
          {session.disconnect_requested ? "Disconnect requested..." : "Disconnect"}
        </Button>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Handled messages
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Deleting removes the message from the wall, not just this list.
        </Typography>
        {deleteError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {deleteError}
          </Alert>
        )}
        {events.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Nothing yet.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 420, overflowY: "auto" }}>
            {events.map((event) => (
              <ListItem
                key={event.id}
                divider
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    size="small"
                    onClick={() => deleteEvent(event.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                {event.image_url && (
                  <ListItemAvatar>
                    <Avatar src={event.image_url} variant="rounded" />
                  </ListItemAvatar>
                )}
                <ListItemText
                  primary={`${event.display_name}: ${event.content || "(no content)"}`}
                  secondary={
                    event.success
                      ? `sent · "${event.raw_message}"`
                      : `failed — ${event.error_message ?? "unknown error"} · "${event.raw_message}"`
                  }
                  slotProps={{
                    secondary: {
                      color: event.success ? "success.main" : "error.main",
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}
