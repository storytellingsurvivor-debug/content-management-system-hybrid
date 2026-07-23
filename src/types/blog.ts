export type FieldUiType =
  | "text"
  | "number"
  | "boolean"
  | "markdown"
  | "url"
  | "datetime"
  | "json"
  | "stringArray"
  | "numberArray"
  | "faq";

// A per-entity FAQ entry. Stored as a jsonb array [{question, answer}] where
// `answer` is markdown. Edited with the FaqField widget, not raw JSON.
export type FaqEntry = { question: string; answer: string };

// jsonb is hand-editable and loosely typed; drop anything that isn't a
// {question, answer} string pair so the widget and the DB stay consistent.
export function normalizeFaq(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const question = (raw as Record<string, unknown>).question;
    const answer = (raw as Record<string, unknown>).answer;
    if (typeof question !== "string" || typeof answer !== "string") return [];
    return [{ question, answer }];
  });
}

export interface BlogColumnDefinition {
  name: string;
  label: string;
  uiType: FieldUiType;
  required: boolean;
  readOnly: boolean;
}

export interface BlogRow {
  id?: number | string;
  [key: string]: unknown;
}

export type EditorMode = "create" | "edit";
export type SubmitAction = "create" | "update" | "delete";
