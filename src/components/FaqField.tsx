"use client";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  DeleteOutlineRounded,
  ArrowUpwardRounded,
  ArrowDownwardRounded,
} from "@mui/icons-material";
import { normalizeFaq, type FaqEntry } from "@/types/blog";

interface FaqFieldProps {
  label: string;
  value: unknown;
  onChange: (next: FaqEntry[]) => void;
}

// Repeatable question/answer editor for the `faq` jsonb column. Keeps the value
// as a real array so both write pipelines (toHappyPayload, toWritablePayload)
// send it straight to Postgres. Answers are markdown.
export function FaqField({ label, value, onChange }: FaqFieldProps) {
  const items = normalizeFaq(value);

  const update = (index: number, patch: Partial<FaqEntry>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };
  const add = () => onChange([...items, { question: "", answer: "" }]);
  const remove = (index: number) =>
    onChange(items.filter((_, i) => i !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Chip
          size="small"
          label={`${items.length} question${items.length === 1 ? "" : "s"}`}
          sx={{ bgcolor: "primary.light", color: "primary.dark" }}
        />
        <Typography variant="caption" color="text.secondary">
          answers support markdown
        </Typography>
      </Box>

      {items.length === 0 && (
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
            p: 2,
            mb: 1.5,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">
            No FAQ yet. Add questions to show a FAQ block (with FAQPage rich
            results) on this page.
          </Typography>
        </Box>
      )}

      {items.map((item, index) => (
        <Paper
          key={index}
          variant="outlined"
          sx={{
            p: 1.75,
            mb: 1.5,
            borderRadius: 2,
            borderLeft: "3px solid",
            borderLeftColor: "primary.main",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 700,
                bgcolor: "primary.light",
                color: "primary.dark",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              onClick={() => move(index, -1)}
              disabled={index === 0}
            >
              <ArrowUpwardRounded fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
            >
              <ArrowDownwardRounded fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => remove(index)}
            >
              <DeleteOutlineRounded fontSize="inherit" />
            </IconButton>
          </Box>
          <TextField
            label="Question"
            value={item.question}
            onChange={(event) =>
              update(index, { question: event.target.value })
            }
            fullWidth
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            label="Answer (markdown)"
            value={item.answer}
            onChange={(event) => update(index, { answer: event.target.value })}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
        </Paper>
      ))}

      <Button startIcon={<AddRounded />} onClick={add} variant="outlined">
        Add question
      </Button>
    </Box>
  );
}
