"use client";

import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { TwitchChannelRow } from "@/types/twitchBot";

interface ChannelFormProps {
  onCreated: (channel: TwitchChannelRow) => void;
}

const EMPTY_FORM = {
  name: "",
  twitch_channel: "",
  happy_wall_id: "",
  target_url: "",
};

export function ChannelForm({ onCreated }: ChannelFormProps) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/twitch/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add channel.");
      onCreated(data.channel as TwitchChannelRow);
      setValues(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Add a Twitch channel
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Label"
          placeholder="e.g. Milo main stream"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          fullWidth
        />
        <TextField
          label="Twitch channel"
          placeholder="happymilo"
          value={values.twitch_channel}
          onChange={(e) => setField("twitch_channel", e.target.value)}
          fullWidth
        />
        <TextField
          label="Happy Wall id"
          value={values.happy_wall_id}
          onChange={(e) => setField("happy_wall_id", e.target.value)}
          fullWidth
        />
        <TextField
          label="Target URL"
          placeholder="https://..."
          value={values.target_url}
          onChange={(e) => setField("target_url", e.target.value)}
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Box>
          <Button
            variant="contained"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Adding..." : "Add channel"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
