"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { TwitchChannelRow } from "@/types/twitchBot";

interface ChannelFormProps {
  onCreated: (channel: TwitchChannelRow) => void;
  onUpdated: (channel: TwitchChannelRow) => void;
  editingChannel: TwitchChannelRow | null;
  onCancelEdit: () => void;
}

const EMPTY_FORM = {
  name: "",
  twitch_channel: "yesromae",
  wall_url: "",
  target_url: "https://www.happy-milo.com/en/happy-wall/messages",
};

function formValuesFor(channel: TwitchChannelRow | null): typeof EMPTY_FORM {
  if (!channel) return EMPTY_FORM;
  return {
    name: channel.name,
    twitch_channel: channel.twitch_channel,
    wall_url: channel.wall_url,
    target_url: channel.target_url,
  };
}

export function ChannelForm({
  onCreated,
  onUpdated,
  editingChannel,
  onCancelEdit,
}: ChannelFormProps) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(editingChannel);

  useEffect(() => {
    setValues(formValuesFor(editingChannel));
    setError(null);
  }, [editingChannel]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/twitch/channels/${editingChannel!.id}`
        : "/api/twitch/channels";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save channel.");
      if (isEditing) {
        onUpdated(data.channel as TwitchChannelRow);
      } else {
        onCreated(data.channel as TwitchChannelRow);
        setValues(EMPTY_FORM);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {isEditing ? `Edit "${editingChannel!.name}"` : "Add a Twitch channel"}
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
          label="Happy Wall URL"
          placeholder="https://www.happy-milo.com/en/happy-wall/some-slug"
          value={values.wall_url}
          onChange={(e) => setField("wall_url", e.target.value)}
          fullWidth
        />
        <TextField
          label="Messages API URL"
          placeholder="https://..."
          value={values.target_url}
          onChange={(e) => setField("target_url", e.target.value)}
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Add channel"}
          </Button>
          {isEditing && (
            <Button variant="outlined" onClick={onCancelEdit}>
              Cancel
            </Button>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
