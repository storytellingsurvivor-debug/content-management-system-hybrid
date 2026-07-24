"use client";

import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogColumnDefinition, BlogRow, EditorMode, SubmitAction } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  rowToForm,
  toHappyPayload,
  validateHappyPayload,
} from "@/lib/happySpotSchema";

export interface AdaptiveFilter {
  field: string;
  value: string | number;
}

interface UseAdaptiveTableOptions {
  client: SupabaseClient | null;
  table: string;
  label: string;
  // Merges the connected schema with sensible defaults so an empty table can
  // still be inserted into. Called with the first loaded row (or null).
  inferColumns: (row: BlogRow | null) => BlogColumnDefinition[];
  // Scopes reads to a parent row (e.g. messages of one wall). Null = load all.
  filter?: AdaptiveFilter | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

function rowSelectionValue(row: BlogRow): string {
  const id = String(row.id ?? "").trim();
  if (id) return `id:${id}`;
  const slug = String(row.slug ?? "").trim();
  return slug ? `slug:${slug}` : "";
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

export interface AdaptiveTableState {
  rows: BlogRow[];
  columns: BlogColumnDefinition[];
  selectedId: string;
  mode: EditorMode;
  form: BlogRow;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  unavailable: string | null;
  load: () => Promise<void>;
  select: (value: string) => void;
  createNew: () => void;
  changeField: (key: string, value: unknown) => void;
  submit: (action: SubmitAction) => Promise<void>;
}

// Generic load/select/create/update/delete against a table whose columns are
// discovered at runtime. Modelled on useHappyTable, plus schema inference and
// an optional parent filter (used to scope a wall's messages).
export function useAdaptiveTable({
  client,
  table,
  label,
  inferColumns,
  filter = null,
  environment,
  onFeedback,
}: UseAdaptiveTableOptions): AdaptiveTableState {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [columns, setColumns] = useState<BlogColumnDefinition[]>(() =>
    inferColumns(null),
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [mode, setMode] = useState<EditorMode>("create");
  const [form, setForm] = useState<BlogRow>(() => rowToForm(null, inferColumns(null)));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const filterField = filter?.field ?? null;
  const filterValue = filter?.value ?? null;

  const load = useCallback(async () => {
    if (!client) return;
    if (filterField && (filterValue === null || filterValue === "")) {
      // Nothing to scope to yet (e.g. no wall selected) — show an empty list.
      setRows([]);
      setSelectedId("");
      setMode("create");
      return;
    }
    setLoading(true);
    let query = client.from(table).select("*").order("id", { ascending: false }).limit(500);
    if (filterField && filterValue !== null) {
      query = query.eq(filterField, filterValue);
    }
    const { data, error: loadError } = await query;

    if (loadError) {
      setUnavailable(readableError(loadError, `Could not load ${table}.`));
      setRows([]);
      setLoading(false);
      return;
    }

    setUnavailable(null);
    const nextRows = (data ?? []) as BlogRow[];
    setRows(nextRows);

    const nextColumns = inferColumns(nextRows[0] ?? null);
    setColumns(nextColumns);

    setSelectedId((prev) => {
      const stillThere = nextRows.find((row) => rowSelectionValue(row) === prev);
      if (prev && stillThere) {
        setMode("edit");
        setForm(rowToForm(stillThere, nextColumns));
        return prev;
      }
      setMode("create");
      setForm(rowToForm(null, nextColumns));
      return "";
    });
    setLoading(false);
  }, [client, table, filterField, filterValue, inferColumns]);

  const select = useCallback(
    (value: string) => {
      setError(null);
      setSelectedId(value);
      if (!value) {
        setMode("create");
        setForm(rowToForm(null, columns));
        return;
      }
      const selected = rows.find((row) => rowSelectionValue(row) === value);
      if (!selected) return;
      setMode("edit");
      setForm(rowToForm(selected, columns));
    },
    [rows, columns],
  );

  const createNew = useCallback(() => {
    setError(null);
    setSelectedId("");
    setMode("create");
    setForm(rowToForm(null, columns));
    onFeedback(`${label} create mode enabled.`);
  }, [columns, label, onFeedback]);

  const changeField = useCallback((key: string, value: unknown) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  }, []);

  const resolveFilter = useCallback((): {
    field: "id" | "slug";
    value: string | number;
  } | null => {
    const id = form.id;
    if (id !== undefined && id !== null && String(id).trim().length > 0) {
      const asNumber = Number(id);
      return Number.isNaN(asNumber)
        ? { field: "id", value: String(id) }
        : { field: "id", value: asNumber };
    }
    const slug = String(form.slug ?? "").trim();
    if (slug) return { field: "slug", value: slug };
    return null;
  }, [form]);

  const confirmProd = useCallback(
    (action: SubmitAction): boolean => {
      if (environment !== "PROD") return true;
      const answer = window.prompt(
        `PROD action: type PROD to confirm ${action.toUpperCase()} on ${table} table.`,
      );
      return answer === "PROD";
    },
    [environment, table],
  );

  const submit = useCallback(
    async (action: SubmitAction) => {
      if (!client) return;
      setError(null);
      onFeedback(null);

      if (!confirmProd(action)) {
        onFeedback("Action cancelled: PROD confirmation not accepted.");
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = toHappyPayload(form, columns);
      } catch (conversionError) {
        setError(readableError(conversionError, "Invalid field value."));
        return;
      }

      if (action !== "delete") {
        const message = validateHappyPayload(payload, columns);
        if (message) {
          setError(message);
          return;
        }
      }

      setSubmitting(true);
      try {
        if (action === "create") {
          const { data, error: createError } = await client
            .from(table)
            .insert(payload)
            .select("*")
            .single();
          if (createError) throw createError;
          const created = (data ?? {}) as BlogRow;
          setSelectedId(rowSelectionValue(created));
          setMode("edit");
          setForm(rowToForm(created, columns));
          onFeedback(`${label} created successfully.`);
        }

        if (action === "update") {
          const target = resolveFilter();
          if (!target) throw new Error("Update requires id or slug.");
          const { data, error: updateError } = await client
            .from(table)
            .update(payload)
            .eq(target.field, target.value)
            .select("*");
          if (updateError) throw updateError;
          if (!data || data.length === 0) {
            throw new Error(
              `Update affected 0 rows. Either the row matching ${target.field}="${target.value}" no longer exists, or the anon key you connected with can't UPDATE ${table} (check the RLS UPDATE policy for the anon role on ${table} in this environment).`,
            );
          }
          setForm(rowToForm(data[0] as BlogRow, columns));
          onFeedback(`${label} updated successfully.`);
        }

        if (action === "delete") {
          const target = resolveFilter();
          if (!target) throw new Error("Delete requires id or slug.");
          const { error: deleteError } = await client
            .from(table)
            .delete()
            .eq(target.field, target.value);
          if (deleteError) throw deleteError;
          onFeedback(`${label} deleted successfully.`);
          setSelectedId("");
          setMode("create");
          setForm(rowToForm(null, columns));
        }

        await load();
      } catch (submitError) {
        setError(readableError(submitError, "Failed to submit to Supabase."));
      } finally {
        setSubmitting(false);
      }
    },
    [client, form, columns, table, label, confirmProd, resolveFilter, load, onFeedback],
  );

  return {
    rows,
    columns,
    selectedId,
    mode,
    form,
    loading,
    submitting,
    error,
    unavailable,
    load,
    select,
    createNew,
    changeField,
    submit,
  };
}
