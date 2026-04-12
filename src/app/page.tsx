"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Container, Typography } from "@mui/material";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArticlesSection } from "@/sections/ArticlesSection/ArticlesSection";
import { ConnectionSection } from "@/sections/ConnectionSection/ConnectionSection";
import { ContentSection } from "@/sections/ContentSection/ContentSection";
import {
  DEFAULT_BLOG_COLUMNS,
  inferColumnsFromRow,
  toWritablePayload,
  validateBlogPayload,
} from "@/lib/blogFormSchema";
import type {
  BlogColumnDefinition,
  BlogRow,
  EditorMode,
  SubmitAction,
} from "@/types/blog";
import type {
  ConnectionFormValues,
  ConnectionViewState,
} from "@/types/connection";

const INITIAL_CONNECTION_VALUES: ConnectionFormValues = {
  environment: "STAGING",
  supabaseUrl: "",
  supabaseAnonKey: "",
};

const INITIAL_CONNECTION_VIEW: ConnectionViewState = {
  status: "idle",
  errorMessage: null,
};

function createEmptyForm(columns: BlogColumnDefinition[]): BlogRow {
  const base: BlogRow = {};
  columns.forEach((column) => {
    if (column.uiType === "boolean") {
      base[column.name] = false;
      return;
    }
    base[column.name] = "";
  });
  return base;
}

function getRowSelectionValue(row: BlogRow): string {
  const id = String(row.id ?? "").trim();
  if (id) return `id:${id}`;
  const slug = String(row.slug ?? "").trim();
  if (slug) return `slug:${slug}`;
  return "";
}

function getReadableError(
  error: unknown,
  fallback = "Connection failed unexpectedly.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (typeof error === "object" && error !== null) {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message.trim()
        : "";
    const details =
      "details" in error && typeof error.details === "string"
        ? error.details.trim()
        : "";
    const hint =
      "hint" in error && typeof error.hint === "string"
        ? error.hint.trim()
        : "";
    const code =
      "code" in error && typeof error.code === "string"
        ? error.code.trim()
        : "";

    const primary = message || fallback;
    const contextParts = [
      details ? `details: ${details}` : "",
      hint ? `hint: ${hint}` : "",
      code ? `code: ${code}` : "",
    ].filter((part) => part.length > 0);

    return contextParts.length > 0
      ? `${primary} (${contextParts.join(" | ")})`
      : primary;
  }

  return fallback;
}

export default function Home() {
  const [connectionValues, setConnectionValues] =
    useState<ConnectionFormValues>(INITIAL_CONNECTION_VALUES);
  const [connectionView, setConnectionView] = useState<ConnectionViewState>(
    INITIAL_CONNECTION_VIEW,
  );
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(
    null,
  );

  const [columns, setColumns] =
    useState<BlogColumnDefinition[]>(DEFAULT_BLOG_COLUMNS);
  const [articles, setArticles] = useState<BlogRow[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [formValues, setFormValues] = useState<BlogRow>(
    createEmptyForm(DEFAULT_BLOG_COLUMNS),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isArticlesLoading, setIsArticlesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [connectionMeta, setConnectionMeta] = useState<string>("idle");
  const isConnected = connectionView.status === "connected";
  const hasAutoConnectedRef = useRef(false);
  const handleConnectRef = useRef<
    (nextValues?: Partial<ConnectionFormValues>) => Promise<void>
  >(async () => {});

  const maskedKey = useMemo(() => {
    const key = connectionValues.supabaseAnonKey.trim();
    if (key.length <= 8) return key ? "********" : "";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }, [connectionValues.supabaseAnonKey]);

  const handleConnectionChange = (
    key: keyof ConnectionFormValues,
    value: string,
  ) => {
    setConnectionValues((previous) => ({ ...previous, [key]: value }));
  };

  const resetEditorState = (nextColumns: BlogColumnDefinition[]) => {
    setColumns(nextColumns);
    setArticles([]);
    setSelectedArticleId("");
    setEditorMode("create");
    setFormValues(createEmptyForm(nextColumns));
    setValidationError(null);
  };

  const loadArticlesAndSchema = async (client: SupabaseClient) => {
    setIsArticlesLoading(true);

    const { data, error } = await client.from("blog").select("*").limit(100);
    if (error) {
      setIsArticlesLoading(false);
      throw error;
    }

    const rows = (data ?? []) as BlogRow[];
    setArticles(rows);

    const nextColumns = inferColumnsFromRow(rows[0] ?? null);
    setColumns(nextColumns);

    if (rows.length === 0) {
      setEditorMode("create");
      setSelectedArticleId("");
      setFormValues(createEmptyForm(nextColumns));
      setIsArticlesLoading(false);
      return;
    }

    const selectedRow =
      rows.find((row) => getRowSelectionValue(row) === selectedArticleId) ??
      rows[0];
    const nextSelection = getRowSelectionValue(selectedRow);
    setSelectedArticleId(nextSelection);
    setEditorMode("edit");
    setFormValues(selectedRow);

    setIsArticlesLoading(false);
  };

  const handleConnect = async (nextValues?: Partial<ConnectionFormValues>) => {
    setFeedbackMessage(null);
    setValidationError(null);
    setConnectionView({
      status: "connecting",
      errorMessage: null,
    });

    const mergedValues: ConnectionFormValues = {
      ...connectionValues,
      ...nextValues,
    };
    const supabaseUrl = mergedValues.supabaseUrl.trim();
    const supabaseAnonKey = mergedValues.supabaseAnonKey.trim();
    setConnectionValues(mergedValues);
    setConnectionMeta("input-received");

    if (!supabaseUrl || !supabaseAnonKey) {
      setConnectionView({
        status: "error",
        errorMessage: "Supabase URL and anon key are required.",
      });
      setConnectionMeta("missing-url-or-key");
      return;
    }

    try {
      setFeedbackMessage("Attempting connection...");
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      setConnectionMeta("query-blog-probe");
      const { error } = await client.from("blog").select("*").limit(1);
      if (error) throw error;

      setSupabaseClient(client);
      setConnectionMeta("loading-articles");
      await loadArticlesAndSchema(client);
      setConnectionView({
        status: "connected",
        errorMessage: null,
      });
      setFeedbackMessage("Connected and loaded blog table data.");
      setConnectionMeta("connected");
    } catch (error) {
      const message = getReadableError(error);
      setSupabaseClient(null);
      resetEditorState(DEFAULT_BLOG_COLUMNS);
      setIsArticlesLoading(false);
      setConnectionView({
        status: "error",
        errorMessage: message,
      });
      setFeedbackMessage(null);
      setConnectionMeta("error");
    }
  };
  handleConnectRef.current = handleConnect;

  const handleDisconnect = () => {
    setSupabaseClient(null);
    setConnectionValues((previous) => ({
      ...previous,
      supabaseUrl: "",
      supabaseAnonKey: "",
    }));
    setConnectionView(INITIAL_CONNECTION_VIEW);
    setFeedbackMessage("Disconnected. Memory session cleared.");
    setConnectionMeta("idle");
    resetEditorState(DEFAULT_BLOG_COLUMNS);
  };

  const handleRefresh = async () => {
    if (!supabaseClient) return;
    setFeedbackMessage(null);
    setValidationError(null);

    try {
      await loadArticlesAndSchema(supabaseClient);
      setFeedbackMessage("Articles and detected fields refreshed.");
      setConnectionView({
        status: "connected",
        errorMessage: null,
      });
    } catch (error) {
      const message = getReadableError(error, "Failed to refresh data.");
      setSupabaseClient(null);
      resetEditorState(DEFAULT_BLOG_COLUMNS);
      setIsArticlesLoading(false);
      setConnectionView((previous) => ({
        ...previous,
        status: "error",
        errorMessage: message,
      }));
    }
  };

  const handleSelectArticle = (selectionValue: string) => {
    setSelectedArticleId(selectionValue);
    setValidationError(null);

    if (!selectionValue) {
      setEditorMode("create");
      setFormValues(createEmptyForm(columns));
      return;
    }

    const selected = articles.find(
      (article) => getRowSelectionValue(article) === selectionValue,
    );
    if (!selected) return;

    setEditorMode("edit");
    setFormValues(selected);
  };

  const handleCreateNew = () => {
    setEditorMode("create");
    setSelectedArticleId("");
    setValidationError(null);
    setFeedbackMessage("Create mode enabled.");
    setFormValues(createEmptyForm(columns));
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setFormValues((previous) => ({ ...previous, [key]: value }));
  };

  const requireProdConfirmation = (action: SubmitAction): boolean => {
    if (connectionValues.environment !== "PROD") return true;
    const answer = window.prompt(
      `PROD action: type PROD to confirm ${action.toUpperCase()} on blog table.`,
    );
    return answer === "PROD";
  };

  const resolveFilterField = (): {
    field: "id" | "slug";
    value: string | number;
  } | null => {
    const id = formValues.id;
    if (id !== undefined && id !== null && String(id).trim().length > 0) {
      const idAsNumber = Number(id);
      return Number.isNaN(idAsNumber)
        ? { field: "id", value: String(id) }
        : { field: "id", value: idAsNumber };
    }

    const slug = String(formValues.slug ?? "").trim();
    if (slug) return { field: "slug", value: slug };
    return null;
  };

  const handleSubmit = async (action: SubmitAction) => {
    if (!supabaseClient) return;
    setValidationError(null);
    setFeedbackMessage(null);

    if (!requireProdConfirmation(action)) {
      setFeedbackMessage("Action cancelled: PROD confirmation not accepted.");
      return;
    }

    const payload = toWritablePayload(formValues, columns);
    if (action === "create") {
      const rawId = String(formValues.id ?? "").trim();
      if (!rawId) {
        setValidationError("Id is required when creating an article.");
        return;
      }

      const numericId = Number(rawId);
      payload.id = Number.isNaN(numericId) ? rawId : numericId;

      const rawCreatedAt = String(formValues.created_at ?? "").trim();
      if (rawCreatedAt) {
        payload.created_at = rawCreatedAt;
      }
    }

    if (action !== "delete") {
      const validationMessage = validateBlogPayload(payload);
      if (validationMessage) {
        setValidationError(validationMessage);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (action === "create") {
        const createPayload = { ...payload };
        if (String(createPayload.created_at ?? "").trim().length === 0) {
          createPayload.created_at = new Date().toISOString();
        }

        const { data, error } = await supabaseClient
          .from("blog")
          .insert(createPayload)
          .select("*")
          .single();
        if (error) throw error;

        const created = (data ?? {}) as BlogRow;
        const nextSelection = getRowSelectionValue(created);
        setSelectedArticleId(nextSelection);
        setEditorMode("edit");
        setFormValues(created);
        setFeedbackMessage("Article created successfully.");
      }

      if (action === "update") {
        const filter = resolveFilterField();
        if (!filter) {
          throw new Error("Update requires id or slug in current form values.");
        }

        const { data, error } = await supabaseClient
          .from("blog")
          .update(payload)
          .eq(filter.field, filter.value)
          .select("*")
          .single();
        if (error) throw error;

        setFormValues((data ?? {}) as BlogRow);
        setFeedbackMessage("Article updated successfully.");
      }

      if (action === "delete") {
        const filter = resolveFilterField();
        if (!filter) {
          throw new Error("Delete requires id or slug in current form values.");
        }

        const { error } = await supabaseClient
          .from("blog")
          .delete()
          .eq(filter.field, filter.value);
        if (error) throw error;

        setFeedbackMessage("Article deleted successfully.");
        setEditorMode("create");
        setSelectedArticleId("");
        setFormValues(createEmptyForm(columns));
      }

      await loadArticlesAndSchema(supabaseClient);
    } catch (error) {
      const message = getReadableError(error, "Failed to submit to Supabase.");
      setValidationError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (hasAutoConnectedRef.current) return;
    if (connectionView.status !== "idle") return;
    if (!connectionValues.supabaseUrl || !connectionValues.supabaseAnonKey)
      return;

    hasAutoConnectedRef.current = true;
    void handleConnectRef.current();
  }, [
    connectionView.status,
    connectionValues.supabaseUrl,
    connectionValues.supabaseAnonKey,
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Supabase Blogs CMS
        </Typography>
        <Typography color="text.secondary">
          Local admin workspace with schema-driven editor and markdown preview.
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
          Connection status: {connectionView.status} ({connectionMeta})
        </Typography>
      </Box>

      {feedbackMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {feedbackMessage}
        </Alert>
      )}
      {connectionView.errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {connectionView.errorMessage}
        </Alert>
      )}

      <ConnectionSection
        values={connectionValues}
        viewState={connectionView}
        onChange={handleConnectionChange}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        maskedKey={maskedKey}
      />

      <ArticlesSection
        isConnected={isConnected}
        isLoading={isArticlesLoading}
        articles={articles}
        selectedArticleId={selectedArticleId}
        columns={columns}
        onSelectArticle={handleSelectArticle}
        onCreateNew={handleCreateNew}
        onRefresh={handleRefresh}
      />

      <ContentSection
        isConnected={isConnected}
        isBusy={isSubmitting}
        mode={editorMode}
        columns={columns}
        values={formValues}
        validationError={validationError}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
      />
    </Container>
  );
}
