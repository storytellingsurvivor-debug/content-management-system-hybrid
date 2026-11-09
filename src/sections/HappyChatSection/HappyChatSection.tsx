"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Chip, Stack } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import {
  HAPPY_CHAT_SITUATION_CONFIG,
  HAPPY_CHAT_SITUATION_SELECTS,
} from "@/lib/happyChatSituationSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "@/sections/HappySpotsSection/HappyTableEditor";
import { useHappyTable } from "@/sections/HappySpotsSection/useHappyTable";

interface HappyChatSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

const LANGUAGES = ["all", "fr", "en"] as const;

/**
 * Happy Chat situation pages: list (filtered by language), create, edit,
 * publish. The category is a free label written in the row's language.
 */
export function HappyChatSection({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappyChatSectionProps) {
  const situations = useHappyTable(client, HAPPY_CHAT_SITUATION_CONFIG, environment, onFeedback);
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("all");

  useEffect(() => {
    if (!isConnected || !client) return;
    void situations.load();
    // Load once connected; the hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const rows = useMemo(
    () =>
      situations.rows.filter(
        (row) => language === "all" || row.language === language,
      ),
    [situations.rows, language],
  );

  const config = HAPPY_CHAT_SITUATION_CONFIG;

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Each situation needs a FR and an EN row sharing the same translation key. Only
        rows with &quot;Is Active&quot; on appear on the site (within a minute). The starter is
        prefilled in the chat and never sent automatically: keep it in the visitor&apos;s voice.
      </Alert>

      {situations.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{config.table}`: {situations.unavailable}
        </Alert>
      )}

      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
        {LANGUAGES.map((value) => (
          <Chip
            key={value}
            label={value === "all" ? "All languages" : value.toUpperCase()}
            color={language === value ? "primary" : "default"}
            onClick={() => setLanguage(value)}
          />
        ))}
      </Stack>

      <TemplatesSection
        title={`Browse ${config.label}`}
        tableName={config.table}
        isConnected={isConnected}
        isLoading={situations.loading}
        templates={rows}
        selectedTemplateId={situations.selectedId}
        columns={config.columns}
        onSelectTemplate={situations.select}
        onCreateNew={situations.createNew}
        onRefresh={situations.load}
      />

      <HappyTableEditor
        title={`Edit ${config.label}`}
        isConnected={isConnected}
        isBusy={situations.submitting}
        mode={situations.mode}
        columns={config.columns}
        groups={config.groups}
        values={situations.form}
        validationError={situations.error}
        relationSelects={HAPPY_CHAT_SITUATION_SELECTS}
        onFieldChange={situations.changeField}
        onSubmit={situations.submit}
      />
    </>
  );
}
