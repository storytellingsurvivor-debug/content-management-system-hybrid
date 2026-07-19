"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Tab, Tabs } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import type { BlogRow } from "@/types/blog";
import { HAPPY_TABLES } from "@/lib/happySpotSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "./HappyTableEditor";
import { useHappyTable } from "./useHappyTable";
import { SpotTagContentPanel } from "./SpotTagContentPanel";

interface HappySpotsSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

type HappySubTab = "spots" | "tags";

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

  const active = subTab === "spots" ? spots : tags;
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

  // A spot's image and note live on its main tag's content row, so the browse
  // cards have to look them up instead of reading the spot itself.
  const spotDisplayBySpotId = useMemo(() => {
    const contentByKey = new Map<string, BlogRow>();
    for (const row of tagContents.rows) {
      contentByKey.set(`${row.spot_id}:${row.tag_id}`, row);
    }
    const display = new Map<
      number,
      { coverUrl: string | null; subtitle: string | null }
    >();
    for (const spot of spots.rows) {
      const content = contentByKey.get(`${spot.id}:${spot.main_tag_id}`);
      display.set(Number(spot.id), {
        coverUrl: String(content?.image_url ?? "").trim() || null,
        subtitle: String(content?.note ?? "").trim() || null,
      });
    }
    return display;
  }, [tagContents.rows, spots.rows]);

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
        resolveDisplay={
          subTab === "spots"
            ? (row) => spotDisplayBySpotId.get(Number(row.id)) ?? {}
            : undefined
        }
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
            : {}
        }
        onFieldChange={active.changeField}
        onSubmit={active.submit}
      />

      {subTab === "spots" && (
        <SpotTagContentPanel
          isConnected={isConnected}
          spots={spots}
          tags={tags}
          tagContents={tagContents}
        />
      )}
    </>
  );
}
