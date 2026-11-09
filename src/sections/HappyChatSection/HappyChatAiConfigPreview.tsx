"use client";

import { Alert, Avatar, Box, Chip, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BlogRow } from "@/types/blog";
import { previewSectionSx } from "@/sections/TemplateEditorSection/styles";

// Live preview for one happy_chat_ai_config row, built from the form values
// as they are typed. Range warnings mirror the table's check constraints so
// a value the database will refuse shows up before saving.

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

type JsonObject = Record<string, unknown>;

// JSON fields are edited as text: empty means {} (the column default).
function parseJsonObject(
  value: unknown,
): { ok: true; value: JsonObject } | { ok: false; error: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ok: true, value: value as JsonObject };
  }
  const raw = str(value);
  if (!raw) return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as JsonObject };
    }
    return { ok: false, error: "must be a JSON object ({ … })" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "invalid JSON",
    };
  }
}

interface NumberCheck {
  key: string;
  label: string;
  min: number;
  max: number;
  integer: boolean;
  optional?: boolean;
}

const NUMBER_CHECKS: NumberCheck[] = [
  {
    key: "temperature",
    label: "Temperature",
    min: 0,
    max: 2,
    integer: false,
    optional: true,
  },
  {
    key: "max_output_tokens",
    label: "Max output tokens",
    min: 100,
    max: 128000,
    integer: true,
  },
  {
    key: "timeout_ms",
    label: "Timeout (ms)",
    min: 5000,
    max: 300000,
    integer: true,
  },
  { key: "max_retries", label: "Max retries", min: 0, max: 5, integer: true },
  {
    key: "history_size",
    label: "History size",
    min: 1,
    max: 200,
    integer: true,
  },
  { key: "max_images", label: "Max images", min: 0, max: 20, integer: true },
];

function checkNumbers(values: BlogRow): string[] {
  const problems: string[] = [];
  for (const check of NUMBER_CHECKS) {
    const raw = str(values[check.key]);
    if (!raw) {
      if (!check.optional) problems.push(`${check.label} is required.`);
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      problems.push(`${check.label} must be a number.`);
    } else if (check.integer && !Number.isInteger(n)) {
      problems.push(`${check.label} must be a whole number.`);
    } else if (n < check.min || n > check.max) {
      problems.push(
        `${check.label} must be between ${check.min} and ${check.max}.`,
      );
    }
  }
  return problems;
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: 0.25,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: "right" }}>
        {value}
      </Typography>
    </Box>
  );
}

const markdownSx = {
  "& p": { my: 1, lineHeight: 1.7 },
  "& ul, & ol": { pl: 3, my: 1 },
  "& h1, & h2, & h3": { mt: 2, mb: 1, fontSize: "1.05rem" },
  "& pre": { whiteSpace: "pre-wrap", wordBreak: "break-word" },
  "& code": { fontFamily: "monospace", fontSize: "0.85em" },
} as const;

const SAMPLE_REPLY: Record<string, string> = {
  markdown:
    "Sure! Here are **two ideas**:\n\n- Take a short walk\n- Write down one thing that went well",
  text: "Sure! Here are two ideas: take a short walk, or write down one thing that went well.",
  html: "<p>Sure! Here are <strong>two ideas</strong>:</p><ul><li>Take a short walk</li><li>Write down one thing that went well</li></ul>",
};

function SampleReply({ format }: { format: string }) {
  if (format === "markdown") {
    return (
      <Box sx={{ ...markdownSx, "& p:first-of-type": { mt: 0 } }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {SAMPLE_REPLY.markdown}
        </ReactMarkdown>
      </Box>
    );
  }
  // html replies are shown as the raw markup the model is asked to send.
  return (
    <Typography
      variant="body2"
      sx={{
        whiteSpace: "pre-wrap",
        fontFamily: format === "html" ? "monospace" : undefined,
      }}
    >
      {SAMPLE_REPLY[format] ?? SAMPLE_REPLY.text}
    </Typography>
  );
}

export function HappyChatAiConfigPreview({ values }: { values: BlogRow }) {
  const name = str(values.name) || "Untitled config";
  const notes = str(values.notes);
  const isActive = values.is_active === true;
  const isEnabled = values.is_enabled !== false;
  const provider = str(values.provider) || "openai";
  const model = str(values.model);
  const reasoning = str(values.reasoning_effort);
  const verbosity = str(values.text_verbosity);
  const temperature = str(values.temperature);
  const maxTokens = str(values.max_output_tokens);
  const timeoutMs = str(values.timeout_ms);
  const retries = str(values.max_retries);
  const historySize = str(values.history_size);
  const maxImages = str(values.max_images);
  const replyFormat = str(values.reply_format) || "markdown";
  const instructions =
    typeof values.instructions === "string" ? values.instructions : "";
  const authorName = str(values.author_name) || "Happy Milo";
  const authorImage = str(values.author_image_url);
  const validAuthorImage = isHttpUrl(authorImage) ? authorImage : "";

  const providerOptions = parseJsonObject(values.provider_options);
  const languageInstructions = parseJsonObject(values.language_instructions);

  const problems = checkNumbers(values);
  if (!str(values.name)) problems.push("Name is required.");
  if (str(values.name).length > 120)
    problems.push("Name must be 120 characters or fewer.");
  if (!model) problems.push("Model is required.");
  if (model.length > 100)
    problems.push("Model must be 100 characters or fewer.");
  if (!instructions.trim()) problems.push("Instructions are required.");
  if (instructions.length > 100000) {
    problems.push("Instructions must be 100,000 characters or fewer.");
  }
  if (authorName.length > 80)
    problems.push("Author name must be 80 characters or fewer.");
  if (authorImage && !validAuthorImage) {
    problems.push("Author image URL must start with http:// or https://.");
  }
  if (!providerOptions.ok)
    problems.push(`Provider options: ${providerOptions.error}.`);
  if (!languageInstructions.ok) {
    problems.push(`Per-language instructions: ${languageInstructions.error}.`);
  }

  const timeoutSeconds =
    timeoutMs && Number.isFinite(Number(timeoutMs))
      ? `${Number(timeoutMs) / 1000} s`
      : "—";
  const languageEntries = languageInstructions.ok
    ? Object.entries(languageInstructions.value)
    : [];
  const providerOptionKeys = providerOptions.ok
    ? Object.keys(providerOptions.value)
    : [];

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Chip
          size="small"
          label={isActive ? "Active (used by the chat)" : "Inactive"}
          color={isActive ? "success" : "default"}
          variant={isActive ? "filled" : "outlined"}
        />
        <Chip
          size="small"
          label={isEnabled ? "Enabled" : "Disabled"}
          color={isEnabled ? "primary" : "warning"}
          variant="outlined"
        />
        <Chip size="small" label={replyFormat} variant="outlined" />
      </Box>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {name}
      </Typography>
      {notes && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: "pre-wrap", mb: 1 }}
        >
          {notes}
        </Typography>
      )}

      {isActive && !isEnabled && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          This config is active but disabled: the chat may be turned off.
        </Alert>
      )}

      {problems.length > 0 && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </Box>
        </Alert>
      )}

      {/* How a reply looks in the chat */}
      <Box sx={previewSectionSx}>
        <Typography variant="caption" color="text.secondary">
          Chat reply ({replyFormat})
        </Typography>
        <Box
          sx={{ display: "flex", gap: 1.5, mt: 1, alignItems: "flex-start" }}
        >
          <Avatar
            src={validAuthorImage || undefined}
            alt={authorName}
            sx={{ width: 36, height: 36 }}
          >
            {authorName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2">{authorName}</Typography>
            <Box
              sx={{
                mt: 0.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <SampleReply format={replyFormat} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={previewSectionSx}>
        <Typography variant="caption" color="text.secondary">
          Model
        </Typography>
        <SettingRow
          label="Provider / model"
          value={`${provider} / ${model || "—"}`}
        />
        <SettingRow
          label="Reasoning effort"
          value={reasoning || "provider default"}
        />
        <SettingRow
          label="Text verbosity"
          value={verbosity || "provider default"}
        />
        <SettingRow
          label="Temperature"
          value={temperature || "provider default"}
        />
        <SettingRow label="Max output tokens" value={maxTokens || "—"} />
        <SettingRow label="Timeout" value={timeoutSeconds} />
        <SettingRow label="Max retries" value={retries || "—"} />
        <SettingRow
          label="Provider options"
          value={
            !providerOptions.ok
              ? "invalid JSON"
              : providerOptionKeys.length > 0
                ? providerOptionKeys.join(", ")
                : "none"
          }
        />
      </Box>

      <Box sx={previewSectionSx}>
        <Typography variant="caption" color="text.secondary">
          Context
        </Typography>
        <SettingRow
          label="History"
          value={historySize ? `${historySize} messages` : "—"}
        />
        <SettingRow label="Images per request" value={maxImages || "—"} />
      </Box>

      <Box sx={previewSectionSx}>
        <Typography variant="caption" color="text.secondary">
          Instructions ({instructions.length.toLocaleString()} / 100,000 chars)
        </Typography>
        {instructions.trim() ? (
          <Box sx={markdownSx}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {instructions}
            </ReactMarkdown>
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled">
            No instructions yet.
          </Typography>
        )}
      </Box>

      {languageEntries.length > 0 && (
        <Box sx={previewSectionSx}>
          <Typography variant="caption" color="text.secondary">
            Per-language instructions
          </Typography>
          {languageEntries.map(([language, text]) => (
            <Box key={language} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={language.toUpperCase()}
                sx={{ mb: 0.5 }}
              />
              {typeof text === "string" ? (
                <Box sx={markdownSx}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {text}
                  </ReactMarkdown>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", m: 0 }}
                >
                  {JSON.stringify(text, null, 2)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
