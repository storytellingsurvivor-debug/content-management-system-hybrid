"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Tab, Tabs } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import { HAPPY_DATE_TABLES } from "@/lib/happyDateSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "@/sections/HappySpotsSection/HappyTableEditor";
import { useHappyTable } from "@/sections/HappySpotsSection/useHappyTable";

interface HappyDatesSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

type HappyDateSubTab = "dates" | "categories";

export function HappyDatesSection({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappyDatesSectionProps) {
  const [subTab, setSubTab] = useState<HappyDateSubTab>("dates");

  const dates = useHappyTable(client, HAPPY_DATE_TABLES.dates, environment, onFeedback);
  const categories = useHappyTable(client, HAPPY_DATE_TABLES.categories, environment, onFeedback);

  useEffect(() => {
    if (!isConnected || !client) return;
    void dates.load();
    void categories.load();
    // Load both once connected; the hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const active = subTab === "dates" ? dates : categories;
  const config = HAPPY_DATE_TABLES[subTab];

  // Existing categories become the options for the date's category_id dropdown,
  // limited to those matching the language currently selected on the date form.
  const dateLanguage = String(dates.form.language ?? "").trim();
  const categoryOptions = useMemo(
    () =>
      categories.rows
        .filter(
          (row) =>
            !dateLanguage ||
            String(row.language ?? "").trim() === dateLanguage,
        )
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
    [categories.rows, dateLanguage],
  );

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={subTab}
          onChange={(_event, value: HappyDateSubTab) => setSubTab(value)}
          aria-label="Happy dates sub tabs"
        >
          <Tab label="Happy date pages" value="dates" />
          <Tab label="Happy date category pages" value="categories" />
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
        showBrandFilter={false}
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
          subTab === "dates"
            ? { category_id: { options: categoryOptions, multiple: false } }
            : {}
        }
        onFieldChange={active.changeField}
        onSubmit={active.submit}
      />
    </>
  );
}
