"use client";

import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { ChannelForm } from "@/sections/TwitchSection/ChannelForm";
import { ChannelHistory } from "@/sections/TwitchSection/ChannelHistory";
import { ConnectPanel } from "@/sections/TwitchSection/ConnectPanel";
import type { TwitchChannelRow } from "@/types/twitchBot";

export function TwitchBotPanel() {
  const [channels, setChannels] = useState<TwitchChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] =
    useState<TwitchChannelRow | null>(null);
  const [editingChannel, setEditingChannel] =
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
    <Box>
      <ChannelForm
        editingChannel={editingChannel}
        onCancelEdit={() => setEditingChannel(null)}
        onCreated={(channel) => setChannels((prev) => [channel, ...prev])}
        onUpdated={(channel) => {
          setChannels((prev) =>
            prev.map((c) => (c.id === channel.id ? channel : c)),
          );
          setSelectedChannel((prev) =>
            prev?.id === channel.id ? channel : prev,
          );
          setEditingChannel(null);
        }}
      />

      <ChannelHistory
        channels={channels}
        selectedChannelId={selectedChannel?.id ?? null}
        onConnect={(channel) => {
          setEditingChannel(null);
          setSelectedChannel(channel);
        }}
        onEdit={(channel) => setEditingChannel(channel)}
        onDelete={async (channel) => {
          const res = await fetch(`/api/twitch/channels/${channel.id}`, {
            method: "DELETE",
          });
          if (!res.ok) return;
          setChannels((prev) => prev.filter((c) => c.id !== channel.id));
          setSelectedChannel((prev) =>
            prev?.id === channel.id ? null : prev,
          );
          setEditingChannel((prev) =>
            prev?.id === channel.id ? null : prev,
          );
        }}
      />

      {selectedChannel && (
        <ConnectPanel key={selectedChannel.id} channel={selectedChannel} />
      )}
    </Box>
  );
}
