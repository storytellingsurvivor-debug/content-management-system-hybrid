"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ConnectionFormValues,
  ConnectionViewState,
  EnvironmentLabel,
} from "@/types/connection";
import {
  actionsRowSx,
  connectionGridSx,
  sectionHeaderRowSx,
  sectionPaperSx,
} from "./styles";

interface ConnectionSectionProps {
  values: ConnectionFormValues;
  viewState: ConnectionViewState;
  onChange: (key: keyof ConnectionFormValues, value: string) => void;
  onConnect: (nextValues?: Partial<ConnectionFormValues>) => void;
  onDisconnect: () => void;
  maskedKey: string;
}

const ENV_COLORS: Record<EnvironmentLabel, "success" | "error"> = {
  STAGING: "success",
  PROD: "error",
};

export function ConnectionSection({
  values,
  viewState,
  onChange,
  onConnect,
  onDisconnect,
  maskedKey,
}: ConnectionSectionProps) {
  const isBusy = viewState.status === "connecting";
  const submitConnection = () => {
    onConnect({
      environment: values.environment,
      supabaseUrl: values.supabaseUrl,
      supabaseAnonKey: values.supabaseAnonKey,
    });
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box sx={sectionHeaderRowSx}>
        <Typography variant="h6">1. Environment Connection</Typography>
        <Chip
          label={values.environment}
          color={ENV_COLORS[values.environment]}
          variant="filled"
        />
      </Box>

      <Box>
        <Box sx={connectionGridSx}>
          <TextField
            select
            label="Environment"
            value={values.environment}
            onChange={(event) =>
              onChange("environment", event.target.value as EnvironmentLabel)
            }
          >
            <MenuItem value="STAGING">STAGING</MenuItem>
            <MenuItem value="PROD">PROD</MenuItem>
          </TextField>

          <TextField
            label="Supabase URL"
            placeholder="https://your-project.supabase.co"
            value={values.supabaseUrl}
            onChange={(event) => onChange("supabaseUrl", event.target.value)}
            autoComplete="off"
            fullWidth
          />

          <TextField
            label="Supabase Anon Key"
            type="password"
            value={values.supabaseAnonKey}
            onChange={(event) =>
              onChange("supabaseAnonKey", event.target.value)
            }
            autoComplete="new-password"
            fullWidth
          />
        </Box>

        <Box sx={actionsRowSx}>
          <Button
            variant="contained"
            type="button"
            disabled={isBusy}
            onClick={submitConnection}
          >
            {isBusy ? "Connecting..." : "Connect"}
          </Button>
          <Button variant="outlined" type="button" onClick={onDisconnect}>
            Disconnect
          </Button>
        </Box>
      </Box>

      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {values.supabaseAnonKey ? (
          <Alert severity="info">Key loaded in memory: {maskedKey}</Alert>
        ) : (
          <Alert severity="info">
            No key persisted. Session is memory-only.
          </Alert>
        )}

        {viewState.status === "connected" && (
          <Alert severity="success">Connected to Supabase successfully.</Alert>
        )}

        {viewState.errorMessage && (
          <Alert severity="error">{viewState.errorMessage}</Alert>
        )}

        {values.environment === "PROD" && (
          <Alert severity="warning">
            PROD mode selected. Write actions will require explicit
            confirmation.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
