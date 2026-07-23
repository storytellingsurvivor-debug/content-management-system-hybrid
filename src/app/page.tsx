"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Chip, Container, Tab, Tabs, Typography } from "@mui/material";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArticlesSection } from "@/sections/ArticlesSection/ArticlesSection";
import { VisitsSection } from "@/sections/VisitsSection/VisitsSection";
import { BucketSection } from "@/sections/BucketSection/BucketSection";
import { ConnectionSection } from "@/sections/ConnectionSection/ConnectionSection";
import { ContentSection } from "@/sections/ContentSection/ContentSection";
import { HappyDatesSection } from "@/sections/HappyDatesSection/HappyDatesSection";
import { HappySpotsSection } from "@/sections/HappySpotsSection/HappySpotsSection";
import { HappyWallSection } from "@/sections/HappyWallSection/HappyWallSection";
import { TemplateEditorSection } from "@/sections/TemplateEditorSection/TemplateEditorSection";
import { TemplatesSection } from "@/sections/TemplatesSection/TemplatesSection";
import {
  DEFAULT_BLOG_COLUMNS,
  inferColumnsFromRow,
  toWritablePayload,
  validateBlogPayload,
} from "@/lib/blogFormSchema";
import {
  BRAND_PRESETS,
  detectWorkspaceFeatures,
  type WorkspaceFeatures,
} from "@/lib/brands";
import {
  DEFAULT_TEMPLATE_COLUMNS,
  findDuplicateTemplate,
  inferTemplateColumns,
  TEMPLATE_TABLE,
  validateTemplatePayload,
} from "@/lib/templateFormSchema";
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

type WorkspaceTab =
  | "blog"
  | "templates"
  | "happy"
  | "happyDates"
  | "happyWall"
  | "visits";

const TEMPLATE_DEFAULTS: Record<string, unknown> = {
  brand: "happy",
  language: "en",
  is_active: true,
};

const INITIAL_CONNECTION_VALUES: ConnectionFormValues = {
  brand: "happy",
  environment: "STAGING",
  supabaseUrl: BRAND_PRESETS[0].url,
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

function createEmptyTemplateForm(columns: BlogColumnDefinition[]): BlogRow {
  const base: BlogRow = {};
  columns.forEach((column) => {
    if (column.name in TEMPLATE_DEFAULTS) {
      base[column.name] = TEMPLATE_DEFAULTS[column.name];
      return;
    }
    if (column.uiType === "boolean") {
      base[column.name] = false;
      return;
    }
    if (column.uiType === "faq") {
      // jsonb array column: empty must be [] so the insert doesn't send "".
      base[column.name] = [];
      return;
    }
    base[column.name] = "";
  });
  return base;
}

// PostgREST caps each response (default max-rows = 1000), so a single
// `.limit(N)` silently drops older rows. We page through the whole table with
// `.range()` until a short page signals the end, guaranteeing every article —
// including the oldest ones — is loaded.
const ROWS_PER_PAGE = 1000;

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
): Promise<BlogRow[]> {
  const allRows: BlogRow[] = [];

  for (let from = 0; ; from += ROWS_PER_PAGE) {
    const to = from + ROWS_PER_PAGE - 1;
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;

    const batch = (data ?? []) as BlogRow[];
    allRows.push(...batch);

    if (batch.length < ROWS_PER_PAGE) break;
  }

  return allRows;
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

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("blog");
  const [templateColumns, setTemplateColumns] = useState<
    BlogColumnDefinition[]
  >(DEFAULT_TEMPLATE_COLUMNS);
  const [templates, setTemplates] = useState<BlogRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateEditorMode, setTemplateEditorMode] =
    useState<EditorMode>("create");
  const [templateFormValues, setTemplateFormValues] = useState<BlogRow>(
    createEmptyTemplateForm(DEFAULT_TEMPLATE_COLUMNS),
  );
  const [templateValidationError, setTemplateValidationError] = useState<
    string | null
  >(null);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false);
  const [templatesUnavailable, setTemplatesUnavailable] = useState<
    string | null
  >(null);
  const [features, setFeatures] = useState<WorkspaceFeatures | null>(null);

  const templateTable = features?.templateTable ?? TEMPLATE_TABLE;
  const isConnected = connectionView.status === "connected";
  // If the current tab's table doesn't exist on the connected DB, fall back to blog.
  const tabAvailable: Record<WorkspaceTab, boolean> = {
    blog: true,
    templates: Boolean(features?.templateTable),
    happy: Boolean(features?.hasSpots),
    happyDates: Boolean(features?.hasDates),
    happyWall: Boolean(features?.wallTable),
    // browsers table exists in every Milo DB; the section shows a graceful
    // warning if a connected DB happens not to have it.
    visits: true,
  };
  const safeTab: WorkspaceTab = tabAvailable[activeTab] ? activeTab : "blog";
  const hasAutoConnectedRef = useRef(false);
  const prefillRef = useRef<Record<string, unknown> | null>(null);
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

  const resetTemplateState = (nextColumns: BlogColumnDefinition[]) => {
    setTemplateColumns(nextColumns);
    setTemplates([]);
    setSelectedTemplateId("");
    setTemplateEditorMode("create");
    setTemplateFormValues(createEmptyTemplateForm(nextColumns));
    setTemplateValidationError(null);
    setTemplatesUnavailable(null);
  };

  const loadTemplatesAndSchema = async (
    client: SupabaseClient,
    table: string,
  ) => {
    setIsTemplatesLoading(true);

    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id", { ascending: false })
      .limit(200);
    if (error) {
      setIsTemplatesLoading(false);
      setTemplatesUnavailable(getReadableError(error));
      setTemplates([]);
      setTemplateColumns(DEFAULT_TEMPLATE_COLUMNS);
      setTemplateEditorMode("create");
      setSelectedTemplateId("");
      setTemplateFormValues(
        createEmptyTemplateForm(DEFAULT_TEMPLATE_COLUMNS),
      );
      return;
    }

    setTemplatesUnavailable(null);
    const rows = (data ?? []) as BlogRow[];
    setTemplates(rows);

    const nextColumns = inferTemplateColumns(rows[0] ?? null);
    setTemplateColumns(nextColumns);

    if (rows.length === 0) {
      setTemplateEditorMode("create");
      setSelectedTemplateId("");
      setTemplateFormValues(createEmptyTemplateForm(nextColumns));
      setIsTemplatesLoading(false);
      return;
    }

    const selectedRow =
      rows.find((row) => getRowSelectionValue(row) === selectedTemplateId) ??
      rows[0];
    const nextSelection = getRowSelectionValue(selectedRow);
    setSelectedTemplateId(nextSelection);
    setTemplateEditorMode("edit");
    setTemplateFormValues(selectedRow);

    setIsTemplatesLoading(false);
  };

  const loadArticlesAndSchema = async (client: SupabaseClient) => {
    setIsArticlesLoading(true);

    let rows: BlogRow[];
    try {
      rows = await fetchAllRows(client, "blog");
    } catch (error) {
      setIsArticlesLoading(false);
      throw error;
    }

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
      setConnectionMeta("detecting-tables");
      // Only tabs whose table exists in this DB get shown.
      const detected = await detectWorkspaceFeatures(client);
      setFeatures(detected);

      setConnectionMeta("loading-articles");
      await Promise.all([
        loadArticlesAndSchema(client),
        detected.templateTable
          ? loadTemplatesAndSchema(client, detected.templateTable)
          : Promise.resolve(),
      ]);
      setConnectionView({
        status: "connected",
        errorMessage: null,
      });
      setFeedbackMessage("Connected and loaded workspace data.");
      setConnectionMeta("connected");
    } catch (error) {
      const message = getReadableError(error);
      setSupabaseClient(null);
      setFeatures(null);
      resetEditorState(DEFAULT_BLOG_COLUMNS);
      resetTemplateState(DEFAULT_TEMPLATE_COLUMNS);
      setIsArticlesLoading(false);
      setIsTemplatesLoading(false);
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
    setFeatures(null);
    setConnectionValues((previous) => ({
      ...previous,
      supabaseAnonKey: "",
    }));
    setConnectionView(INITIAL_CONNECTION_VIEW);
    setFeedbackMessage("Disconnected. Memory session cleared.");
    setConnectionMeta("idle");
    resetEditorState(DEFAULT_BLOG_COLUMNS);
    resetTemplateState(DEFAULT_TEMPLATE_COLUMNS);
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

  const handleRefreshTemplates = async () => {
    if (!supabaseClient) return;
    setFeedbackMessage(null);
    setTemplateValidationError(null);
    try {
      await loadTemplatesAndSchema(supabaseClient, templateTable);
      setFeedbackMessage("Templates and detected fields refreshed.");
    } catch (error) {
      const message = getReadableError(
        error,
        "Failed to refresh templates.",
      );
      setTemplateValidationError(message);
    }
  };

  const handleSelectTemplate = (selectionValue: string) => {
    setSelectedTemplateId(selectionValue);
    setTemplateValidationError(null);

    if (!selectionValue) {
      setTemplateEditorMode("create");
      setTemplateFormValues(createEmptyTemplateForm(templateColumns));
      return;
    }

    const selected = templates.find(
      (template) => getRowSelectionValue(template) === selectionValue,
    );
    if (!selected) return;

    setTemplateEditorMode("edit");
    setTemplateFormValues(selected);
  };

  const handleCreateNewTemplate = () => {
    setTemplateEditorMode("create");
    setSelectedTemplateId("");
    setTemplateValidationError(null);
    setFeedbackMessage("Template create mode enabled.");
    setTemplateFormValues(createEmptyTemplateForm(templateColumns));
  };

  const handleTemplateFieldChange = (key: string, value: unknown) => {
    setTemplateFormValues((previous) => ({ ...previous, [key]: value }));
  };

  const requireProdConfirmationFor = (
    action: SubmitAction,
    tableName: string,
  ): boolean => {
    if (connectionValues.environment !== "PROD") return true;
    const answer = window.prompt(
      `PROD action: type PROD to confirm ${action.toUpperCase()} on ${tableName} table.`,
    );
    return answer === "PROD";
  };

  const resolveTemplateFilter = (): {
    field: "id" | "slug";
    value: string | number;
  } | null => {
    const id = templateFormValues.id;
    if (id !== undefined && id !== null && String(id).trim().length > 0) {
      const idAsNumber = Number(id);
      return Number.isNaN(idAsNumber)
        ? { field: "id", value: String(id) }
        : { field: "id", value: idAsNumber };
    }
    const slug = String(templateFormValues.slug ?? "").trim();
    if (slug) return { field: "slug", value: slug };
    return null;
  };

  const handleTemplateSubmit = async (action: SubmitAction) => {
    if (!supabaseClient) return;
    setTemplateValidationError(null);
    setFeedbackMessage(null);

    if (!requireProdConfirmationFor(action, templateTable)) {
      setFeedbackMessage("Action cancelled: PROD confirmation not accepted.");
      return;
    }

    const payload = toWritablePayload(templateFormValues, templateColumns);

    if (action !== "delete") {
      const validationMessage = validateTemplatePayload(payload);
      if (validationMessage) {
        setTemplateValidationError(validationMessage);
        return;
      }

      const duplicate = findDuplicateTemplate(
        templates,
        payload,
        action === "update" ? templateFormValues.id : undefined,
      );
      if (duplicate) {
        const brandPart =
          "brand" in payload ? `brand="${payload.brand}", ` : "";
        setTemplateValidationError(
          `A template already exists with ${brandPart}slug="${payload.slug}", language="${payload.language}" (#${duplicate.id}).`,
        );
        return;
      }
    }

    setIsTemplateSubmitting(true);
    try {
      if (action === "create") {
        const { data, error } = await supabaseClient
          .from(templateTable)
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;

        const created = (data ?? {}) as BlogRow;
        const nextSelection = getRowSelectionValue(created);
        setSelectedTemplateId(nextSelection);
        setTemplateEditorMode("edit");
        setTemplateFormValues(created);
        setFeedbackMessage("Template created successfully.");
      }

      if (action === "update") {
        const filter = resolveTemplateFilter();
        if (!filter) {
          throw new Error(
            "Update requires id or slug in current template values.",
          );
        }
        const { error, count } = await supabaseClient
          .from(templateTable)
          .update(payload, { count: "exact" })
          .eq(filter.field, filter.value);
        if (error) throw error;
        if (count === 0) {
          throw new Error(
            `Update affected 0 rows. The row matching ${filter.field}="${filter.value}" is either gone or the connected key is not allowed to update it (likely RLS: no UPDATE policy for the anon role on ${templateTable}).`,
          );
        }

        setFeedbackMessage("Template updated successfully.");
      }

      if (action === "delete") {
        const filter = resolveTemplateFilter();
        if (!filter) {
          throw new Error(
            "Delete requires id or slug in current template values.",
          );
        }
        const { error } = await supabaseClient
          .from(templateTable)
          .delete()
          .eq(filter.field, filter.value);
        if (error) throw error;

        setFeedbackMessage("Template deleted successfully.");
        setTemplateEditorMode("create");
        setSelectedTemplateId("");
        setTemplateFormValues(createEmptyTemplateForm(templateColumns));
      }

      await loadTemplatesAndSchema(supabaseClient, templateTable);
    } catch (error) {
      const message = getReadableError(
        error,
        "Failed to submit to Supabase.",
      );
      setTemplateValidationError(message);
    } finally {
      setIsTemplateSubmitting(false);
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

  // Decode ?prefill=<base64url-JSON> on mount and store for later application
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("prefill");
    if (!raw) return;
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(raw)));
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
        prefillRef.current = decoded as Record<string, unknown>;
      }
    } catch {
      console.warn("Invalid prefill param — skipping.");
    }
  }, []);

  // Apply prefill to the form once the Supabase connection is established
  useEffect(() => {
    if (connectionView.status !== "connected") return;
    if (!prefillRef.current) return;
    const decoded = prefillRef.current;
    prefillRef.current = null;
    setFormValues((prev) => ({ ...prev, ...decoded }));
    setEditorMode("create");
    setSelectedArticleId("");
    setFeedbackMessage(
      "Form pre-filled from URL — review and click Create to publish.",
    );
  }, [connectionView.status]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          color: "common.white",
          background:
            "linear-gradient(120deg, #4F46E5 0%, #6366F1 45%, #EC4899 120%)",
          boxShadow: "0 18px 40px -24px rgba(79,70,229,0.65)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            fontSize: 28,
            bgcolor: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(4px)",
            flexShrink: 0,
          }}
        >
          🎉
        </Box>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="h4" sx={{ mb: 0.25 }}>
            Milo CMS
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
            One workspace per brand — pick a brand, connect, and only the
            content types in that database show up.
          </Typography>
        </Box>
        <Chip
          label={isConnected ? `Connected · ${connectionMeta}` : "Not connected"}
          sx={{
            fontWeight: 700,
            color: isConnected ? "common.white" : "#4F46E5",
            bgcolor: isConnected
              ? "rgba(22,163,74,0.95)"
              : "rgba(255,255,255,0.95)",
          }}
        />
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

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={safeTab}
          onChange={(_event, value: WorkspaceTab) => setActiveTab(value)}
          aria-label="Workspace tabs"
        >
          <Tab label="Blog articles" value="blog" />
          {features?.templateTable && (
            <Tab label="Happy Wall templates" value="templates" />
          )}
          {features?.hasSpots && <Tab label="Happy Spots" value="happy" />}
          {features?.hasDates && (
            <Tab label="Happy Dates" value="happyDates" />
          )}
          {features?.wallTable && <Tab label="Happy Wall" value="happyWall" />}
          <Tab label="Visits" value="visits" />
        </Tabs>
      </Box>

      {safeTab === "blog" && (
        <>
          <ArticlesSection
            isConnected={isConnected}
            isLoading={isArticlesLoading}
            client={supabaseClient}
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
        </>
      )}

      {safeTab === "templates" && (
        <>
          {templatesUnavailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Could not load `{templateTable}`: {templatesUnavailable}
            </Alert>
          )}

          <TemplatesSection
            isConnected={isConnected}
            isLoading={isTemplatesLoading}
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            columns={templateColumns}
            onSelectTemplate={handleSelectTemplate}
            onCreateNew={handleCreateNewTemplate}
            onRefresh={handleRefreshTemplates}
            tableName={templateTable}
          />

          <TemplateEditorSection
            isConnected={isConnected}
            isBusy={isTemplateSubmitting}
            mode={templateEditorMode}
            columns={templateColumns}
            values={templateFormValues}
            validationError={templateValidationError}
            onFieldChange={handleTemplateFieldChange}
            onSubmit={handleTemplateSubmit}
          />
        </>
      )}

      {safeTab === "happy" && (
        <HappySpotsSection
          isConnected={isConnected}
          client={supabaseClient}
          environment={connectionValues.environment}
          onFeedback={setFeedbackMessage}
        />
      )}

      {safeTab === "happyDates" && (
        <HappyDatesSection
          isConnected={isConnected}
          client={supabaseClient}
          environment={connectionValues.environment}
          onFeedback={setFeedbackMessage}
        />
      )}

      {safeTab === "happyWall" && features?.wallTable && (
        <HappyWallSection
          isConnected={isConnected}
          client={supabaseClient}
          environment={connectionValues.environment}
          onFeedback={setFeedbackMessage}
          table={features.wallTable}
        />
      )}

      {safeTab === "visits" && (
        <VisitsSection isConnected={isConnected} client={supabaseClient} />
      )}

      <BucketSection isConnected={isConnected} client={supabaseClient} />
    </Container>
  );
}
