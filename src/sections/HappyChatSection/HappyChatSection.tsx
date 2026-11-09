"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Chip, Stack, Tab, Tabs } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentLabel } from "@/types/connection";
import {
  HAPPY_CHAT_SITUATION_CONFIG,
  HAPPY_CHAT_SITUATION_SELECTS,
} from "@/lib/happyChatSituationSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "@/sections/HappySpotsSection/HappyTableEditor";
import { useHappyTable } from "@/sections/HappySpotsSection/useHappyTable";
import { HappyChatAiConfigPanel } from "./HappyChatAiConfigPanel";
import { HappyChatConversationsPanel } from "./HappyChatConversationsPanel";

interface HappyChatSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

const LANGUAGES = ["all", "fr", "en"] as const;

type HappyChatPanel = "situations" | "aiConfig" | "conversations";

/**
 * Happy Chat tab: situation pages, the chat's AI config and the visitors'
 * conversations (read-only).
 */
export function HappyChatSection(props: HappyChatSectionProps) {
  const [panel, setPanel] = useState<HappyChatPanel>("situations");

  return (
    <>
      <Tabs
        value={panel}
        onChange={(_, value: HappyChatPanel) => setPanel(value)}
        sx={{ mb: 2 }}
      >
        <Tab label="Situations" value="situations" />
        <Tab label="AI config" value="aiConfig" />
        <Tab label="Conversations" value="conversations" />
      </Tabs>
      {panel === "situations" && <SituationsPanel {...props} />}
      {panel === "aiConfig" && <HappyChatAiConfigPanel {...props} />}
      {panel === "conversations" && <HappyChatConversationsPanel {...props} />}
    </>
  );
}

/**
 * Happy Chat situation pages, active and inactive: list (filtered by
 * language), create, edit, publish. The category is a free label written
 * in the row's language.
 */
function SituationsPanel({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappyChatSectionProps) {
  const situations = useHappyTable(
    client,
    HAPPY_CHAT_SITUATION_CONFIG,
    environment,
    onFeedback,
  );
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
  // The site's read policy only exposes active rows. If the CMS key gets
  // nothing else, inactive drafts silently vanish from the list.
  const allActive =
    situations.rows.length > 0 &&
    situations.rows.every((row) => row.is_active === true);

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Each language has its own row and slug. Only rows with &quot;Is
        Active&quot; on appear on the site (within a minute). The starter is
        prefilled in the chat and never sent automatically: keep it in the
        visitor&apos;s voice.
      </Alert>

      {!situations.loading && allActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Every row loaded is active. If inactive situations are missing here,
          the connected key can only read active rows: add the CMS policy from
          docs/happy-chat.md to this project (staging and prod).
        </Alert>
      )}

      {situations.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{config.table}`: {situations.unavailable}
        </Alert>
      )}

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
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
