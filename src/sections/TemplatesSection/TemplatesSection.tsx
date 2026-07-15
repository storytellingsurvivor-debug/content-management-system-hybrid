"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import type { BlogColumnDefinition, BlogRow } from "@/types/blog";
import { TEMPLATE_TABLE } from "@/lib/templateFormSchema";
import { TemplateCard } from "./TemplateCard";
import {
  controlsGridSx,
  infoRowSx,
  scrollRowSx,
  sectionHeaderSx,
  sectionPaperSx,
} from "./styles";

interface TemplatesSectionProps {
  isConnected: boolean;
  isLoading: boolean;
  templates: BlogRow[];
  selectedTemplateId: string;
  columns: BlogColumnDefinition[];
  onSelectTemplate: (value: string) => void;
  onCreateNew: () => void;
  onRefresh: () => void | Promise<void>;
  title?: string;
  tableName?: string;
}

function templateOptionValue(row: BlogRow): string {
  const id = String(row.id ?? "").trim();
  if (id) return `id:${id}`;
  const slug = String(row.slug ?? "").trim();
  return slug ? `slug:${slug}` : "";
}

function pickField(row: BlogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

// "live" / "off" from is_live or is_active, "" when the row has neither flag.
function rowStatus(row: BlogRow): "live" | "off" | "" {
  for (const key of ["is_live", "is_active"]) {
    const value = row[key];
    if (typeof value === "boolean") return value ? "live" : "off";
  }
  return "";
}

export function TemplatesSection({
  isConnected,
  isLoading,
  templates,
  selectedTemplateId,
  columns,
  onSelectTemplate,
  onCreateNew,
  onRefresh,
  title = "2. Templates",
  tableName = TEMPLATE_TABLE,
}: TemplatesSectionProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");

  const hasStatusFlag = useMemo(
    () => templates.some((template) => rowStatus(template) !== ""),
    [templates],
  );

  const distinctLanguages = useMemo(() => {
    return Array.from(
      new Set(
        templates
          .map((template) => pickField(template, "language", "lang", "locale"))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (statusFilter && rowStatus(template) !== statusFilter) {
        return false;
      }
      if (
        languageFilter &&
        pickField(template, "language", "lang", "locale") !== languageFilter
      ) {
        return false;
      }
      return true;
    });
  }, [templates, statusFilter, languageFilter]);

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <Typography variant="h6" sx={sectionHeaderSx}>
        {title}
      </Typography>

      {!isConnected ? (
        <Alert severity="info">
          Connect to Supabase first, then you can load and select templates.
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              ...(controlsGridSx as object),
              ...(hasStatusFlag
                ? {}
                : { gridTemplateColumns: { xs: "1fr", md: "1fr auto auto" } }),
            }}
          >
            {hasStatusFlag && (
              <TextField
                select
                label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={isLoading}
                fullWidth
              >
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="live">Live / Active</MenuItem>
                <MenuItem value="off">Inactive</MenuItem>
              </TextField>
            )}

            <TextField
              select
              label="Filter by language"
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value)}
              disabled={isLoading || distinctLanguages.length === 0}
              fullWidth
            >
              <MenuItem value="">All languages</MenuItem>
              {distinctLanguages.map((language) => (
                <MenuItem key={language} value={language}>
                  {language.toUpperCase()}
                </MenuItem>
              ))}
            </TextField>

            <Button variant="outlined" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="contained"
              onClick={onCreateNew}
              disabled={isLoading}
            >
              Create New
            </Button>
          </Box>

          <Box sx={infoRowSx}>
            <Chip
              label={`${visibleTemplates.length}/${templates.length} template(s)`}
              variant="outlined"
            />
            <Chip
              label={`${columns.length} field(s) detected`}
              variant="outlined"
            />
            {selectedTemplateId && (
              <Chip
                label="Clear selection"
                onDelete={() => onSelectTemplate("")}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          {visibleTemplates.length > 0 && (
            <Box sx={scrollRowSx} role="listbox" aria-label="Templates">
              {visibleTemplates.map((template) => {
                const value = templateOptionValue(template);
                if (!value) return null;
                return (
                  <TemplateCard
                    key={value}
                    template={template}
                    isSelected={value === selectedTemplateId}
                    onSelect={() => onSelectTemplate(value)}
                  />
                );
              })}
            </Box>
          )}

          {!isLoading && templates.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Connected, but no rows were returned from table `{tableName}`.
              Verify data exists and anon SELECT policy allows these rows.
            </Alert>
          )}
          {!isLoading &&
            templates.length > 0 &&
            visibleTemplates.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No rows match the selected filters.
              </Alert>
            )}
        </>
      )}
    </Paper>
  );
}
