"use client";

import { FormControlLabel, Switch, TextField } from "@mui/material";
import type { BlogColumnDefinition } from "@/types/blog";

function fieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function toDateTimeLocalValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function datetimeLocalInputToIso(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

interface AdaptiveFieldProps {
  column: BlogColumnDefinition;
  value: unknown;
  multiline: boolean;
  onChange: (value: unknown) => void;
}

// Renders one runtime-discovered column as the appropriate MUI control.
export function AdaptiveField({
  column,
  value,
  multiline,
  onChange,
}: AdaptiveFieldProps) {
  if (column.uiType === "boolean") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            disabled={column.readOnly}
          />
        }
        label={column.label}
      />
    );
  }

  const type =
    column.uiType === "number"
      ? "number"
      : column.uiType === "datetime"
        ? "datetime-local"
        : column.uiType === "url"
          ? "url"
          : "text";

  const helper =
    column.uiType === "json"
      ? "Valid JSON"
      : column.uiType === "url"
        ? "Full URL (https://…)"
        : undefined;

  return (
    <TextField
      label={column.label}
      value={
        column.uiType === "datetime"
          ? toDateTimeLocalValue(value)
          : fieldValue(value)
      }
      onChange={(event) =>
        onChange(
          column.uiType === "datetime"
            ? datetimeLocalInputToIso(event.target.value)
            : event.target.value,
        )
      }
      required={column.required}
      slotProps={{ input: { readOnly: column.readOnly } }}
      helperText={helper}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      type={multiline ? "text" : type}
      fullWidth
      size="small"
    />
  );
}
