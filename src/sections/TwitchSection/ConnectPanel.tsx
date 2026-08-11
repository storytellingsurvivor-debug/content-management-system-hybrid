"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTwitchBotSession } from "@/hooks/useTwitchBotSession";
import type { SessionStatus, TwitchChannelRow } from "@/types/twitchBot";

interface ConnectPanelProps {
  channel: TwitchChannelRow;
}

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

export function ConnectPanel({ channel }: ConnectPanelProps) {
  const [credentialsError, setCredentialsError] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    status,
    statusDetail,
    shareUrl,
    triggerCommand,
    events,
    isBusy,
    connect,
    deleteEvent,
    disconnect,
  } = useTwitchBotSession(channel);

  const handleConnect = async () => {
    setCredentialsError(null);
    const res = await fetch("/api/twitch/credentials");
    const data = await res.json();
    if (!res.ok) {
      setCredentialsError(
        data.error ?? "Could not load Twitch credentials from the server.",
      );
      return;
    }
    await connect({
      clientId: data.client_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Typography variant="h6">
          Connect · {channel.name} (#{channel.twitch_channel})
        </Typography>
        <Chip label={status} color={STATUS_COLORS[status]} size="small" />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Uses the bot account&rsquo;s Twitch credentials configured on the
        server (TWITCH_CLIENT_ID / TWITCH_ACCESS_TOKEN / TWITCH_REFRESH_TOKEN)
        — nothing to fill in here.
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          disabled={
            isBusy || status === "connected" || status === "connecting"
          }
          onClick={handleConnect}
        >
          {status === "connecting" ? "Connecting..." : "Connect"}
        </Button>
        <Button
          variant="outlined"
          disabled={status !== "connected" && status !== "error"}
          onClick={() => disconnect()}
        >
          Disconnect
        </Button>
      </Stack>

      {credentialsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {credentialsError}
        </Alert>
      )}

      {statusDetail && <Alert severity="error" sx={{ mb: 2 }}>{statusDetail}</Alert>}

      {shareUrl && (
        <Alert
          severity="info"
          sx={{ mb: 2, wordBreak: "break-all" }}
          action={
            <Button
              size="small"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              Copy
            </Button>
          }
        >
          Share this link with the moderator: {shareUrl}
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Current trigger: <code>{triggerCommand}</code> — editable from the
        shared link once connected.
      </Typography>

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Handled messages
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
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
        <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
          {events.map((event) => (
            <ListItem
              key={event.id}
              divider
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="delete"
                  size="small"
                  onClick={async () => {
                    setDeleteError(null);
                    const error = await deleteEvent(event.id);
                    if (error) setDeleteError(error);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
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
  );
}
