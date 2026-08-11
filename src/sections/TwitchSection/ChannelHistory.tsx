"use client";

import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { TwitchChannelRow } from "@/types/twitchBot";

interface ChannelHistoryProps {
  channels: TwitchChannelRow[];
  selectedChannelId: string | null;
  onConnect: (channel: TwitchChannelRow) => void;
  onDelete: (channel: TwitchChannelRow) => void;
}

export function ChannelHistory({
  channels,
  selectedChannelId,
  onConnect,
  onDelete,
}: ChannelHistoryProps) {
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Channels
      </Typography>
      {channels.length === 0 ? (
        <Typography color="text.secondary">
          No channels yet — add one above.
        </Typography>
      ) : (
        <List disablePadding>
          {channels.map((channel) => (
            <ListItem
              key={channel.id}
              divider
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <Button
                    variant={
                      channel.id === selectedChannelId
                        ? "contained"
                        : "outlined"
                    }
                    onClick={() => onConnect(channel)}
                  >
                    Connect
                  </Button>
                  <Button
                    color="error"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete channel "${channel.name}"? This also removes its session/message history.`,
                        )
                      ) {
                        onDelete(channel);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Stack>
              }
            >
              <ListItemText
                primary={channel.name}
                secondary={
                  <Box component="span">
                    #{channel.twitch_channel} · wall {channel.happy_wall_id}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
