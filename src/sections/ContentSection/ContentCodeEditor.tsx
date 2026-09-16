"use client";

import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Box, Button, Tooltip, Typography, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import { useId, useState } from "react";

// `@uiw/react-textarea-code-editor` reaches for browser APIs (it highlights
// via a client-only rehype pass), so it must not be server-rendered. In this
// version of Next.js, `dynamic(..., { ssr: false })` is only allowed inside a
// Client Component — hence the "use client" directive above and the wrapper
// living in its own module rather than being imported by a Server Component.
const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <Box
        sx={{
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          fontSize: 14,
        }}
      >
        Loading editor…
      </Box>
    ),
  },
);

interface ContentCodeEditorProps {
  label: string;
  value: string;
  language: "html" | "markdown";
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

// Pretty-print the current content with Prettier. Both Prettier and its
// language plugins are imported lazily (only when "Format" is clicked) so they
// stay out of the initial client bundle — this editor is an admin-only tool.
async function formatContent(
  source: string,
  language: "html" | "markdown",
): Promise<string> {
  const prettier = await import("prettier/standalone");
  const plugin =
    language === "html"
      ? (await import("prettier/plugins/html")).default
      : (await import("prettier/plugins/markdown")).default;

  return prettier.format(source, {
    parser: language,
    plugins: [plugin],
  });
}

export function ContentCodeEditor({
  label,
  value,
  language,
  required = false,
  placeholder,
  onChange,
}: ContentCodeEditorProps) {
  const theme = useTheme();
  const editorId = useId();
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleFormat = async () => {
    if (!value.trim()) return;
    setIsFormatting(true);
    setFormatError(null);
    try {
      const formatted = await formatContent(value, language);
      // Prettier appends a trailing newline; trim it so repeated formatting
      // doesn't keep growing the trailing whitespace.
      onChange(formatted.replace(/\n$/, ""));
    } catch {
      setFormatError(
        language === "html"
          ? "Could not format — check the HTML for syntax errors."
          : "Could not format — check the Markdown for syntax errors.",
      );
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography
          component="label"
          htmlFor={editorId}
          variant="body2"
          color="text.secondary"
        >
          {label}
          {required ? " *" : ""}
        </Typography>
        <Tooltip title={`Format ${language === "html" ? "HTML" : "Markdown"}`}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
              onClick={handleFormat}
              disabled={isFormatting || !value.trim()}
            >
              {isFormatting ? "Formatting…" : "Format"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {formatError && (
        <Typography variant="caption" color="error">
          {formatError}
        </Typography>
      )}

      <Box
        // The library reads `data-color-mode` to pick its light/dark palette;
        // keep it in sync with the active MUI theme so the editor matches the
        // rest of the admin UI.
        data-color-mode={theme.palette.mode}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: "auto",
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          transition: theme.transitions.create("border-color"),
          "&:focus-within": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
          },
          "& .w-tc-editor": {
            backgroundColor: "transparent !important",
            minHeight: "100%",
          },
          "& .w-tc-editor-text, & .w-tc-editor textarea": {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important',
          },
        }}
      >
        <CodeEditor
          id={editorId}
          value={value}
          language={language}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          data-color-mode={theme.palette.mode}
          padding={16}
          style={{
            fontSize: 14,
            minHeight: 320,
            backgroundColor: "transparent",
          }}
        />
      </Box>
    </Box>
  );
}
