"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Tab, Tabs } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import { HAPPY_TABLES } from "@/lib/happySpotSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "./HappyTableEditor";
import { useHappyTable } from "./useHappyTable";

interface HappySpotsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

type HappySubTab = "spots" | "tags" | "tagContents";

export function HappySpotsSection({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappySpotsSectionProps) {
  const [subTab, setSubTab] = useState<HappySubTab>("spots");

  const spots = useHappyTable(client, HAPPY_TABLES.spots, environment, onFeedback);
  const tags = useHappyTable(client, HAPPY_TABLES.tags, environment, onFeedback);
  const tagContents = useHappyTable(
    client,
    HAPPY_TABLES.tagContents,
    environment,
    onFeedback,
  );

  useEffect(() => {
    if (!isConnected || !client) return;
    void spots.load();
    void tags.load();
    void tagContents.load();
    // Load all once connected; the hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const active =
    subTab === "spots" ? spots : subTab === "tags" ? tags : tagContents;
  const config = HAPPY_TABLES[subTab];

  // Existing tags become the options for the spot's main_tag_id / tag_ids dropdowns.
  const tagOptions = useMemo(
    () =>
      tags.rows
        .map((row) => {
          const value = String(row.id ?? "").trim();
          const label = String(row.label ?? row.slug ?? "").trim();
          const language = String(row.language ?? "").trim();
          return {
            value,
            label: `${label || value}${language ? ` · ${language}` : ""} (#${value})`,
          };
        })
        .filter((option) => option.value),
    [tags.rows],
  );

  // Same, for the spot_id picker on tag-content rows.
  const spotOptions = useMemo(
    () =>
      spots.rows
        .map((row) => {
          const value = String(row.id ?? "").trim();
          const label = String(row.name ?? row.slug ?? "").trim();
          const language = String(row.language ?? "").trim();
          return {
            value,
            label: `${label || value}${language ? ` · ${language}` : ""} (#${value})`,
          };
        })
        .filter((option) => option.value),
    [spots.rows],
  );

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={subTab}
          onChange={(_event, value: HappySubTab) => setSubTab(value)}
          aria-label="Happy spots sub tabs"
        >
          <Tab label="Happy spot pages" value="spots" />
          <Tab label="Happy spot tag pages" value="tags" />
          <Tab label="Spot content per tag" value="tagContents" />
        </Tabs>
      </Box>

      {active.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{config.table}`: {active.unavailable}
        </Alert>
      )}

      <TemplatesSection
        title={`Browse ${config.label}`}
        tableName={config.table}
        isConnected={isConnected}
        isLoading={active.loading}
        templates={active.rows}
        selectedTemplateId={active.selectedId}
        columns={config.columns}
        onSelectTemplate={active.select}
        onCreateNew={active.createNew}
        onRefresh={active.load}
      />

      <HappyTableEditor
        title={`Edit ${config.label}`}
        isConnected={isConnected}
        isBusy={active.submitting}
        mode={active.mode}
        columns={config.columns}
        groups={config.groups}
        values={active.form}
        validationError={active.error}
        relationSelects={
          subTab === "spots"
            ? {
                main_tag_id: { options: tagOptions, multiple: false },
                tag_ids: { options: tagOptions, multiple: true },
              }
            : subTab === "tagContents"
              ? {
                  spot_id: { options: spotOptions, multiple: false },
                  tag_id: { options: tagOptions, multiple: false },
                }
              : {}
        }
        onFieldChange={active.changeField}
        onSubmit={active.submit}
      />
    </>
  );
}
