"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  List,
  ListItemButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SupabaseClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EnvironmentLabel } from "@/types/connection";
import { sectionPaperSx } from "@/sections/TemplateEditorSection/styles";

import {
  MESSAGE_LIMIT,
  MESSAGE_TABLE,
  CONVERSATION_TABLE,
  useHappyChatConversations,
  type ConversationFilters,
  type ConversationRow,
  type MessageRow,
} from "./useHappyChatConversations";

// Read-only viewer for the visitors' chats: happy_chat_conversation (list)
// and happy_chat_message (the thread of the selected conversation).

interface HappyChatConversationsPanelProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  environment: EnvironmentLabel;
  onFeedback: (message: string | null) => void;
}

type Language = ConversationFilters["language"];
type Status = ConversationFilters["status"];
const LANGUAGES: Language[] = ["all", "en", "fr"];
const STATUSES: Status[] = ["all", "active", "inactive"];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

// Browser signatures are long opaque strings: show the start only.
function shortSignature(value: string | null | undefined): string {
  if (!value) return "";
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function messageCount(row: ConversationRow): number | null {
  const count = row.happy_chat_message?.[0]?.count;
  return typeof count === "number" ? count : null;
}

function isEmptyJson(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Happy Chat conversations: browse them and read each thread. Read-only. */
export function HappyChatConversationsPanel({
  isConnected,
  client,
  environment,
}: HappyChatConversationsPanelProps) {
  const [language, setLanguage] = useState<Language>("all");
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");

  const {
    conversations,
    loading,
    hasMore,
    listError,
    loadConversations,
    selected,
    messages,
    messagesLoading,
    messagesError,
    loadThread,
  } = useHappyChatConversations(client);

  // Reload from the top when connected, or when a server filter changes.
  useEffect(() => {
    if (!isConnected || !client) return;
    void loadConversations(0, { language, status });
    // The hook callbacks are stable per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client, environment, language, status]);

  // Text search runs on the loaded page(s) only.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((row) =>
      [row.title, row.last_message_preview, row.browser_signature, row.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [conversations, search]);

  // Prefer the freshest copy of the selected row after a list refresh.
  const current =
    conversations.find((row) => row.id === selected?.id) ?? selected;

  if (!isConnected) {
    return (
      <Paper elevation={2} sx={sectionPaperSx}>
        <Alert severity="info">Connect to Supabase first.</Alert>
      </Paper>
    );
  }

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Read-only. Visitors&apos; chats, newest activity first. Select a
        conversation to read its messages. These are private messages: the
        connected key needs read access to both chat tables (see
        docs/happy-chat.md).
      </Alert>

      {listError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{CONVERSATION_TABLE}`: {listError}
        </Alert>
      )}

      {!loading && !listError && conversations.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No conversation found. If visitors have chatted, the connected key
          cannot read these tables: RLS hides the rows instead of returning an
          error. Connect with the service role key (docs/happy-chat.md).
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(320px, 2fr) 3fr" },
          alignItems: "start",
        }}
      >
        <Paper elevation={2} sx={{ ...sectionPaperSx, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              mb: 2,
            }}
          >
            <Typography variant="h6">Conversations</Typography>
            <Button
              size="small"
              onClick={() => void loadConversations(0, { language, status })}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {LANGUAGES.map((value) => (
                <Chip
                  key={value}
                  size="small"
                  label={
                    value === "all" ? "All languages" : value.toUpperCase()
                  }
                  color={language === value ? "primary" : "default"}
                  onClick={() => setLanguage(value)}
                />
              ))}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {STATUSES.map((value) => (
                <Chip
                  key={value}
                  size="small"
                  label={
                    value === "all"
                      ? "All statuses"
                      : value === "active"
                        ? "Active"
                        : "Inactive"
                  }
                  color={status === value ? "primary" : "default"}
                  onClick={() => setStatus(value)}
                />
              ))}
            </Stack>
            <TextField
              size="small"
              label="Search loaded conversations"
              placeholder="Title, last message, signature or id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
            />
          </Stack>

          <List
            dense
            disablePadding
            sx={{ maxHeight: { lg: 640 }, overflowY: "auto", mx: -1 }}
          >
            {visible.map((row) => (
              <ConversationItem
                key={row.id}
                row={row}
                selected={row.id === selected?.id}
                onSelect={() => void loadThread(row)}
              />
            ))}
          </List>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading &&
            search.trim() &&
            visible.length === 0 &&
            conversations.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No loaded conversation matches. Load more to search further.
              </Typography>
            )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              mt: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {conversations.length} loaded
            </Typography>
            {hasMore && (
              <Button
                size="small"
                variant="outlined"
                disabled={loading}
                onClick={() =>
                  void loadConversations(conversations.length, {
                    language,
                    status,
                  })
                }
              >
                Load more
              </Button>
            )}
          </Box>
        </Paper>

        <Paper elevation={2} sx={{ ...sectionPaperSx, minWidth: 0 }}>
          {!current ? (
            <Typography color="text.secondary">
              Select a conversation to read its messages.
            </Typography>
          ) : (
            <ConversationThread
              conversation={current}
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              onRefresh={() => void loadThread(current)}
            />
          )}
        </Paper>
      </Box>
    </>
  );
}

function ConversationItem({
  row,
  selected,
  onSelect,
}: {
  row: ConversationRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const count = messageCount(row);
  return (
    <ListItemButton
      selected={selected}
      onClick={onSelect}
      sx={{ display: "block", borderRadius: 1, py: 1 }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {row.title.trim() || "Untitled conversation"}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          {formatDate(row.last_message_at)}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {row.last_message_author_type && (
          <Box component="span" sx={{ fontWeight: 600 }}>
            {row.last_message_author_type}:{" "}
          </Box>
        )}
        {row.last_message_preview || "No message yet"}
      </Typography>
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        sx={{ mt: 0.5, flexWrap: "wrap" }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={row.language.toUpperCase()}
        />
        {count !== null && (
          <Chip
            size="small"
            variant="outlined"
            label={`${count} message${count === 1 ? "" : "s"}`}
          />
        )}
        {!row.is_active && (
          <Chip size="small" color="warning" label="Inactive" />
        )}
      </Stack>
    </ListItemButton>
  );
}

function ConversationThread({
  conversation,
  messages,
  loading,
  error,
  onRefresh,
}: {
  conversation: ConversationRow;
  messages: MessageRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="h6" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
          {conversation.title.trim() || "Untitled conversation"}
        </Typography>
        <Button size="small" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        sx={{ mb: 1, flexWrap: "wrap" }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={conversation.language.toUpperCase()}
        />
        <Chip
          size="small"
          color={conversation.is_active ? "success" : "warning"}
          label={conversation.is_active ? "Active" : "Inactive"}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`visitor ${shortSignature(conversation.browser_signature)}`}
          title={conversation.browser_signature}
        />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{ mb: 2 }}
      >
        Started {formatDate(conversation.created_at)} · last message{" "}
        {formatDate(conversation.last_message_at)} · id {conversation.id}
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load `{MESSAGE_TABLE}`: {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        !error &&
        (messages.length === 0 ? (
          <Alert severity="info">
            No message returned. If the list shows messages for this
            conversation, the connected key cannot read `{MESSAGE_TABLE}`.
          </Alert>
        ) : (
          <Stack
            spacing={1.5}
            sx={{
              p: { xs: 1, sm: 2 },
              borderRadius: 1.5,
              bgcolor: "background.default",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              maxHeight: { lg: 720 },
              overflowY: "auto",
            }}
          >
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                ownerSignature={conversation.browser_signature}
              />
            ))}
            {messages.length >= MESSAGE_LIMIT && (
              <Alert severity="info">
                Showing the first {MESSAGE_LIMIT} messages only.
              </Alert>
            )}
          </Stack>
        ))
      )}
    </>
  );
}

const AUTHOR_LABELS: Record<MessageRow["author_type"], string> = {
  user: "Visitor",
  ai: "AI",
  bot: "Bot",
  system: "System",
};

function MessageBubble({
  message,
  ownerSignature,
}: {
  message: MessageRow;
  ownerSignature: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isUser = message.author_type === "user";
  const isSystem = message.author_type === "system";
  // A user message from another browser than the conversation owner's.
  const otherVisitor =
    isUser &&
    message.browser_signature &&
    message.browser_signature !== ownerSignature;
  const name =
    message.author_name?.trim() ||
    AUTHOR_LABELS[message.author_type] ||
    message.author_type;
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : [];
  const hasDetails =
    !isEmptyJson(message.metadata) || Boolean(message.client_id);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        justifyContent: isSystem ? "center" : "flex-start",
        alignItems: "flex-start",
        gap: 1,
      }}
    >
      {!isSystem && (
        <Avatar
          src={message.author_image_url || undefined}
          alt={name}
          sx={{ width: 32, height: 32, fontSize: 14 }}
        >
          {name.charAt(0).toUpperCase()}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: isSystem ? "100%" : "85%",
          minWidth: 0,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser
            ? "primary.main"
            : isSystem
              ? "action.hover"
              : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: (theme) =>
            isUser ? "none" : `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            flexWrap: "wrap",
            mb: 0.5,
            opacity: 0.85,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {name}
          </Typography>
          <Typography variant="caption">
            {formatDate(message.created_at)}
          </Typography>
          {message.content_format !== "text" && (
            <Typography variant="caption">
              · {message.content_format}
            </Typography>
          )}
          {otherVisitor && (
            <Typography
              variant="caption"
              title={message.browser_signature ?? ""}
            >
              · other browser {shortSignature(message.browser_signature)}
            </Typography>
          )}
        </Box>

        <MessageContent message={message} />

        {attachments.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {attachments.map((attachment, index) => (
              <AttachmentView key={index} attachment={attachment} />
            ))}
          </Stack>
        )}

        {hasDetails && (
          <>
            <Button
              size="small"
              color="inherit"
              onClick={() => setDetailsOpen((open) => !open)}
              sx={{
                mt: 0.5,
                px: 0,
                minWidth: 0,
                textTransform: "none",
                opacity: 0.8,
              }}
            >
              {detailsOpen ? "Hide details" : "Details"}
            </Button>
            <Collapse in={detailsOpen}>
              <JsonBlock
                value={{
                  ...(message.client_id
                    ? { client_id: message.client_id }
                    : {}),
                  ...(isEmptyJson(message.metadata)
                    ? {}
                    : { metadata: message.metadata }),
                }}
              />
            </Collapse>
          </>
        )}
      </Box>
    </Box>
  );
}

function MessageContent({ message }: { message: MessageRow }) {
  if (!message.content) return null;
  if (message.content_format === "markdown") {
    return (
      <Box
        sx={{
          overflowWrap: "anywhere",
          "& > :first-of-type": { mt: 0 },
          "& > :last-child": { mb: 0 },
          "& a": { color: "inherit" },
          "& pre": { overflowX: "auto" },
          "& ol, & ul": { pl: 3 },
          "& blockquote": {
            mx: 0,
            pl: 1.5,
            borderLeft: "3px solid",
            borderColor: "divider",
            opacity: 0.85,
          },
          "& img": { maxWidth: "100%" },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </Box>
    );
  }
  // Plain text, and HTML shown as its source: chat content is written by
  // visitors, so it is never injected into the CMS page.
  return (
    <Typography
      variant="body2"
      component="div"
      sx={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily: message.content_format === "html" ? "monospace" : undefined,
      }}
    >
      {message.content}
    </Typography>
  );
}

// Attachments are free-form jsonb: show a link or image when a URL is
// found, and the raw JSON otherwise.
function AttachmentView({ attachment }: { attachment: unknown }) {
  const record =
    attachment && typeof attachment === "object" && !Array.isArray(attachment)
      ? (attachment as Record<string, unknown>)
      : null;
  const url =
    typeof attachment === "string"
      ? attachment
      : (["url", "src", "href", "publicUrl", "public_url"]
          .map((key) => record?.[key])
          .find((value): value is string => typeof value === "string") ?? "");
  const safeUrl = /^https?:\/\//i.test(url) ? url : "";
  const label =
    (["name", "filename", "file_name", "title"]
      .map((key) => record?.[key])
      .find((value): value is string => typeof value === "string") ??
      "") ||
    safeUrl;
  const type = String(
    record?.type ?? record?.mime_type ?? record?.mimeType ?? "",
  );
  const isImage =
    type.startsWith("image") ||
    /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(safeUrl);

  if (!safeUrl) return <JsonBlock value={attachment} />;
  return (
    <Box>
      {isImage && (
        <Box
          component="a"
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "block" }}
        >
          <Box
            component="img"
            src={safeUrl}
            alt={label}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: 240,
              borderRadius: 1,
            }}
          />
        </Box>
      )}
      <Typography
        variant="caption"
        component="a"
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "inherit", overflowWrap: "anywhere" }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        mt: 0.5,
        p: 1,
        borderRadius: 1,
        bgcolor: "action.hover",
        color: "text.primary",
        fontSize: 12,
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}
