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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { BRAND_PRESETS, type BrandKey } from "@/lib/brands";
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
      brand: values.brand,
      environment: values.environment,
      supabaseUrl: values.supabaseUrl,
      supabaseAnonKey: values.supabaseAnonKey,
    });
  };

  const selectBrand = (brand: BrandKey) => {
    const preset = BRAND_PRESETS.find((entry) => entry.key === brand);
    onChange("brand", brand);
    // Prefill the project URL (still editable); "Autre" starts blank.
    onChange("supabaseUrl", preset?.url ?? "");
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Box sx={sectionHeaderRowSx}>
        <Typography variant="h6">1. Environment Connection</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip
            label={
              BRAND_PRESETS.find((preset) => preset.key === values.brand)
                ?.label ?? values.brand
            }
            color="primary"
            variant="outlined"
          />
          <Chip
            label={values.environment}
            color={ENV_COLORS[values.environment]}
            variant="filled"
          />
        </Box>
      </Box>

      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Choose the brand to manage — the Supabase URL is prefilled and
            stays editable.
          </Typography>
          <ToggleButtonGroup
            exclusive
            color="primary"
            value={values.brand}
            onChange={(_event, brand: BrandKey | null) => {
              if (brand) selectBrand(brand);
            }}
            size="small"
            sx={{ flexWrap: "wrap" }}
          >
            {BRAND_PRESETS.map((preset) => (
              <ToggleButton key={preset.key} value={preset.key}>
                {preset.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

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
