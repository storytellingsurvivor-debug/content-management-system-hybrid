"use client";

import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogRow, EditorMode, SubmitAction } from "@/types/blog";
import type { EnvironmentLabel } from "@/types/connection";
import {
  type HappyTableConfig,
  rowToForm,
  toHappyPayload,
  validateHappyPayload,
} from "@/lib/happySpotSchema";

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

export interface HappyTableState {
  rows: BlogRow[];
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

export function useHappyTable(
  client: SupabaseClient | null,
  config: HappyTableConfig,
  environment: EnvironmentLabel,
  onFeedback: (message: string | null) => void,
): HappyTableState {
  const { table, columns } = config;
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [mode, setMode] = useState<EditorMode>("create");
  const [form, setForm] = useState<BlogRow>(() => rowToForm(null, columns));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    const { data, error: loadError } = await client
      .from(table)
      .select("*")
      .order("id", { ascending: false })
      .limit(200);

    if (loadError) {
      setUnavailable(readableError(loadError, `Could not load ${table}.`));
      setRows([]);
      setLoading(false);
      return;
    }

    setUnavailable(null);
    const nextRows = (data ?? []) as BlogRow[];
    setRows(nextRows);
    // Keep the current selection if it still exists; otherwise reset to create.
    setSelectedId((prev) => {
      const stillThere = nextRows.some((row) => rowSelectionValue(row) === prev);
      if (prev && stillThere) {
        const selected = nextRows.find((row) => rowSelectionValue(row) === prev)!;
        setMode("edit");
        setForm(rowToForm(selected, columns));
        return prev;
      }
      setMode("create");
      setForm(rowToForm(null, columns));
      return "";
    });
    setLoading(false);
  }, [client, table, columns]);

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
    onFeedback(`${config.label} create mode enabled.`);
  }, [columns, config.label, onFeedback]);

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
          onFeedback(`${config.label} created successfully.`);
        }

        if (action === "update") {
          const filter = resolveFilter();
          if (!filter) throw new Error("Update requires id or slug.");
          // Return the updated rows (anon can read every row on these tables), so a
          // real success can't be misreported the way a bare count can.
          const { data, error: updateError } = await client
            .from(table)
            .update(payload)
            .eq(filter.field, filter.value)
            .select("*");
          if (updateError) throw updateError;
          if (!data || data.length === 0) {
            throw new Error(
              `Update affected 0 rows. Either the row matching ${filter.field}="${filter.value}" no longer exists, or the anon key you connected with can't UPDATE ${table}. Confirm the CMS connection points to the same Supabase project where you added the "cms anon all ${table}" policy (staging vs prod).`,
            );
          }
          setForm(rowToForm(data[0] as BlogRow, columns));
          onFeedback(`${config.label} updated successfully.`);
        }

        if (action === "delete") {
          const filter = resolveFilter();
          if (!filter) throw new Error("Delete requires id or slug.");
          const { error: deleteError } = await client
            .from(table)
            .delete()
            .eq(filter.field, filter.value);
          if (deleteError) throw deleteError;
          onFeedback(`${config.label} deleted successfully.`);
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
    [client, form, columns, table, config.label, confirmProd, resolveFilter, load, onFeedback],
  );

  return {
    rows,
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
