"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// Read-only data for the Conversations panel: a paged list of
// happy_chat_conversation rows and the happy_chat_message thread of the
// selected one. Nothing here writes to the database.

export const CONVERSATION_TABLE = "happy_chat_conversation";
export const MESSAGE_TABLE = "happy_chat_message";
export const CONVERSATION_PAGE_SIZE = 50;
// A thread longer than this is cut; the panel says so.
export const MESSAGE_LIMIT = 1000;

export interface ConversationRow {
  id: string;
  browser_signature: string;
  title: string;
  language: string;
  is_active: boolean;
  created_at: string;
  last_message_at: string;
  last_message_preview: string;
  last_message_author_type: string | null;
  last_message_browser_signature: string | null;
  // Embedded by PostgREST through the message foreign key.
  happy_chat_message?: { count: number }[];
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  browser_signature: string | null;
  author_type: "user" | "ai" | "bot" | "system";
  author_name: string | null;
  author_image_url: string | null;
  content_format: "text" | "markdown" | "html";
  content: string;
  attachments: unknown;
  metadata: unknown;
  client_id: string | null;
  created_at: string;
}

export interface ConversationFilters {
  language: "all" | "en" | "fr";
  status: "all" | "active" | "inactive";
}

export function useHappyChatConversations(client: SupabaseClient | null) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Another project or environment: forget everything read from the old one.
  const [previousClient, setPreviousClient] = useState(client);
  if (client !== previousClient) {
    setPreviousClient(client);
    setConversations([]);
    setHasMore(false);
    setListError(null);
    setSelected(null);
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(false);
  }

  // Responses are dropped when a newer request started or the client changed.
  const clientRef = useRef(client);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);
  const listRequest = useRef(0);
  const threadRequest = useRef(0);

  const loadConversations = useCallback(
    async (offset: number, filters: ConversationFilters) => {
      if (!client) return;
      const request = ++listRequest.current;
      setLoading(true);
      setListError(null);

      let query = client
        .from(CONVERSATION_TABLE)
        .select(`*, ${MESSAGE_TABLE}(count)`)
        .order("last_message_at", { ascending: false })
        .range(offset, offset + CONVERSATION_PAGE_SIZE - 1);
      if (filters.language !== "all") {
        query = query.eq("language", filters.language);
      }
      if (filters.status !== "all") {
        query = query.eq("is_active", filters.status === "active");
      }

      const { data, error } = await query;
      if (request !== listRequest.current || client !== clientRef.current) {
        return;
      }
      setLoading(false);
      if (error) {
        setListError(error.message || `Could not read ${CONVERSATION_TABLE}.`);
        if (offset === 0) setConversations([]);
        setHasMore(false);
        return;
      }
      const rows = (data ?? []) as ConversationRow[];
      setConversations((previous) =>
        offset === 0 ? rows : [...previous, ...rows],
      );
      setHasMore(rows.length === CONVERSATION_PAGE_SIZE);
    },
    [client],
  );

  const loadThread = useCallback(
    async (conversation: ConversationRow) => {
      if (!client) return;
      const request = ++threadRequest.current;
      setSelected(conversation);
      setMessagesLoading(true);
      setMessagesError(null);
      setMessages([]);

      const { data, error } = await client
        .from(MESSAGE_TABLE)
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(MESSAGE_LIMIT);
      if (request !== threadRequest.current || client !== clientRef.current) {
        return;
      }
      setMessagesLoading(false);
      if (error) {
        setMessagesError(error.message || `Could not read ${MESSAGE_TABLE}.`);
        return;
      }
      setMessages((data ?? []) as MessageRow[]);
    },
    [client],
  );

  return {
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
  };
}
