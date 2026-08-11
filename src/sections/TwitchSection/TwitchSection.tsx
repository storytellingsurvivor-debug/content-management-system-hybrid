"use client";

import { useEffect, useState } from "react";
import { Container, Typography } from "@mui/material";
import { ChannelForm } from "./ChannelForm";
import { ChannelHistory } from "./ChannelHistory";
import { ConnectPanel } from "./ConnectPanel";
import type { TwitchChannelRow } from "@/types/twitchBot";

export function TwitchSection() {
  const [channels, setChannels] = useState<TwitchChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] =
    useState<TwitchChannelRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/twitch/channels");
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setChannels(data.channels as TwitchChannelRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Twitch bot
      </Typography>

      <ChannelForm
        onCreated={(channel) => setChannels((prev) => [channel, ...prev])}
      />

      <ChannelHistory
        channels={channels}
        selectedChannelId={selectedChannel?.id ?? null}
        onConnect={setSelectedChannel}
      />

      {selectedChannel && (
        <ConnectPanel key={selectedChannel.id} channel={selectedChannel} />
      )}
    </Container>
  );
}
