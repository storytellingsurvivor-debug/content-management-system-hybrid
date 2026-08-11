"use client";

import { useEffect, useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import { detectMessageTable } from "@/lib/happyWallSchema";
import { WallManagerPanel, type SelectedWall } from "./WallManagerPanel";
import { MessagesPanel } from "./MessagesPanel";
import { HappyBoxPanel } from "./HappyBoxPanel";
import { BubblesChoreographyPanel } from "./BubblesChoreographyPanel";
import { WallAnalyticsPanel } from "./WallAnalyticsPanel";
import { TwitchBotPanel } from "./TwitchBotPanel";

interface HappyWallSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
  // "happy_wall" on Happy-Milo, "hope_wall" on older DBs (resolved at connect).
  table: string;
}

type WallSubTab =
  | "walls"
  | "happyBox"
  | "choreography"
  | "analytics"
  | "twitchBot";

export function HappyWallSection({
  isConnected,
  client,
  environment,
  onFeedback,
  table,
}: HappyWallSectionProps) {
  const [subTab, setSubTab] = useState<WallSubTab>("walls");
  const [selectedWall, setSelectedWall] = useState<SelectedWall | null>(null);
  const [messageTable, setMessageTable] = useState<string | null>(null);

  // Find the audience-message table for this DB once connected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !client) {
        if (!cancelled) setMessageTable(null);
        return;
      }
      const found = await detectMessageTable(client, table);
      if (!cancelled) setMessageTable(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, client, table]);

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={subTab}
          onChange={(_event, value: WallSubTab) => setSubTab(value)}
          aria-label="Happy wall sub tabs"
        >
          <Tab label="Walls" value="walls" />
          <Tab label="Happy Box" value="happyBox" />
          <Tab label="Bubbles choreography" value="choreography" />
          <Tab label="Analytics" value="analytics" />
          <Tab label="Twitch bot" value="twitchBot" />
        </Tabs>
      </Box>

      {/* Kept mounted so the shared wall selection survives tab switches. */}
      <Box sx={{ display: subTab === "walls" ? "block" : "none" }}>
        <WallManagerPanel
          isConnected={isConnected}
          client={client}
          environment={environment}
          table={table}
          onSelectWall={setSelectedWall}
          onFeedback={onFeedback}
        />
        <Box sx={{ mt: 3 }}>
          <MessagesPanel
            isConnected={isConnected}
            client={client}
            environment={environment}
            wallTable={table}
            detectedMessageTable={messageTable}
            selectedWall={selectedWall}
            onFeedback={onFeedback}
          />
        </Box>
      </Box>

      {subTab === "happyBox" && (
        <HappyBoxPanel
          isConnected={isConnected}
          client={client}
          environment={environment}
          wallTable={table}
          detectedMessageTable={messageTable}
          selectedWall={selectedWall}
          onFeedback={onFeedback}
        />
      )}

      {subTab === "choreography" && (
        <BubblesChoreographyPanel
          isConnected={isConnected}
          client={client}
          environment={environment}
          onFeedback={onFeedback}
          table={table}
        />
      )}

      {subTab === "analytics" && (
        <WallAnalyticsPanel
          isConnected={isConnected}
          client={client}
          table={table}
        />
      )}

      {subTab === "twitchBot" && <TwitchBotPanel />}
    </>
  );
}
