"use client";

import { useEffect } from "react";
import { Alert } from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  HAPPY_CHAT_AI_CONFIG,
  HAPPY_CHAT_AI_CONFIG_SELECTS,
} from "@/lib/happyChatAiConfigSchema";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import { HappyTableEditor } from "@/sections/HappySpotsSection/HappyTableEditor";
import { useHappyTable } from "@/sections/HappySpotsSection/useHappyTable";

interface HappyChatAiConfigPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

const config = HAPPY_CHAT_AI_CONFIG;

// Card subtitle: the settings that matter at a glance.
function describeConfig(row: BlogRow) {
  const parts = [row.model, row.reasoning_effort, row.reply_format]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (row.is_enabled === false) parts.push("disabled");
  const image = String(row.author_image_url ?? "").trim();
  return { subtitle: parts.join(" · "), coverUrl: image || null };
}

/** Happy Chat AI settings (happy_chat_ai_config): list, create, edit. */
export function HappyChatAiConfigPanel({
  isConnected,
  client,
  environment,
  onFeedback,
}: HappyChatAiConfigPanelProps) {
  const aiConfigs = useHappyTable(client, config, environment, onFeedback);

  useEffect(() => {
    if (!isConnected || !client) return;
    void aiConfigs.load();
    // Load once connected; the hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  const hasActive = aiConfigs.rows.some((row) => row.is_active === true);

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        The chat uses the one config with &quot;Is Active&quot; on. Turning it
        on for a config turns it off on the others. To try a change safely,
        create a new config, then activate it.
      </Alert>

      {aiConfigs.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{config.table}`: {aiConfigs.unavailable}
        </Alert>
      )}

      {!aiConfigs.loading &&
        !aiConfigs.unavailable &&
        aiConfigs.rows.length > 0 &&
        !hasActive && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No config is active. Turn on &quot;Is Active&quot; on the config the
            chat should use.
          </Alert>
        )}

      <TemplatesSection
        title={`Browse ${config.label}`}
        tableName={config.table}
        isConnected={isConnected}
        isLoading={aiConfigs.loading}
        templates={aiConfigs.rows}
        selectedTemplateId={aiConfigs.selectedId}
        columns={config.columns}
        onSelectTemplate={aiConfigs.select}
        onCreateNew={aiConfigs.createNew}
        onRefresh={aiConfigs.load}
        resolveDisplay={describeConfig}
      />

      <HappyTableEditor
        title={`Edit ${config.label}`}
        isConnected={isConnected}
        isBusy={aiConfigs.submitting}
        mode={aiConfigs.mode}
        columns={config.columns}
        groups={config.groups}
        values={aiConfigs.form}
        validationError={aiConfigs.error}
        relationSelects={HAPPY_CHAT_AI_CONFIG_SELECTS}
        onFieldChange={aiConfigs.changeField}
        onSubmit={aiConfigs.submit}
      />
    </>
  );
}
