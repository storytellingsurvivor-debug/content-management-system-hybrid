"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
  const [clientId, setClientId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const {
    status,
    statusDetail,
    shareUrl,
    triggerCommand,
    events,
    isBusy,
    connect,
    disconnect,
  } = useTwitchBotSession(channel);

  const canConnect =
    clientId.trim() && accessToken.trim() && refreshToken.trim() && !isBusy;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Typography variant="h6">
          Connect · {channel.name} (#{channel.twitch_channel})
        </Typography>
        <Chip label={status} color={STATUS_COLORS[status]} size="small" />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kept in this tab&rsquo;s memory only — never saved anywhere. Get these
        from your own Twitch OAuth flow for the bot&rsquo;s account
        (chat:read + chat:edit scopes).
      </Typography>

      <Stack spacing={2} sx={{ mb: 2, maxWidth: 480 }}>
        <TextField
          label="Twitch Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={status === "connected" || status === "connecting"}
          fullWidth
        />
        <TextField
          label="Access token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          disabled={status === "connected" || status === "connecting"}
          fullWidth
        />
        <TextField
          label="Refresh token"
          type="password"
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          disabled={status === "connected" || status === "connecting"}
          fullWidth
        />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          disabled={!canConnect || status === "connected"}
          onClick={() =>
            connect({
              clientId: clientId.trim(),
              accessToken: accessToken.trim(),
              refreshToken: refreshToken.trim(),
            })
          }
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
      {events.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          Nothing yet.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
          {events.map((event) => (
            <ListItem key={event.id} divider>
              <ListItemText
                primary={`${event.display_name}: ${event.raw_message}`}
                secondary={
                  event.success
                    ? "sent"
                    : `failed — ${event.error_message ?? "unknown error"}`
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
