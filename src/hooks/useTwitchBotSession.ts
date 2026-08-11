"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatClient } from "@twurple/chat";
import {
  BrowserTwitchAuthProvider,
  validateTwitchToken,
} from "@/lib/twitchBrowserAuthProvider";
import {
  buildCommandPayload,
  buildHopeWallBody,
  relayToHopeWall,
} from "@/lib/twitchCommandParsing";
import type {
  SessionStatus,
  TwitchChannelRow,
  TwitchSessionEventRow,
  TwitchSessionRow,
} from "@/types/twitchBot";

const POLL_INTERVAL_MS = 3000;

interface ConnectArgs {
  clientId: string;
  accessToken: string;
  refreshToken: string;
}

async function patchSession(
  shareToken: string,
  patch: Record<string, unknown>,
): Promise<TwitchSessionRow | null> {
  const res = await fetch(`/api/twitch/sessions/${shareToken}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.session as TwitchSessionRow;
}

async function fetchAvatarUrl(login: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `/api/twitch/helix/avatar?login=${encodeURIComponent(login)}`,
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.avatar_url ?? undefined;
  } catch {
    return undefined;
  }
}

export function useTwitchBotSession(channel: TwitchChannelRow) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [triggerCommand, setTriggerCommand] = useState("!happy_wall");
  const [events, setEvents] = useState<TwitchSessionEventRow[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const chatClientRef = useRef<ChatClient | null>(null);
  const shareTokenRef = useRef<string | null>(null);
  const triggerRef = useRef("!happy_wall");
  const successMessageRef = useRef("sent to the wall!");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    stopPolling();
    chatClientRef.current?.quit();
    chatClientRef.current = null;
    if (shareTokenRef.current) {
      await patchSession(shareTokenRef.current, { status: "disconnected" });
    }
    setStatus("disconnected");
    setIsBusy(false);
  }, [stopPolling]);

  const startPolling = useCallback(
    (shareToken: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        const res = await fetch(`/api/twitch/sessions/${shareToken}`);
        if (!res.ok) return;
        const data = await res.json();
        const session = data.session as TwitchSessionRow;
        triggerRef.current = session.trigger_command;
        successMessageRef.current = session.success_message;
        setTriggerCommand(session.trigger_command);
        setEvents(data.events as TwitchSessionEventRow[]);
        if (session.disconnect_requested) {
          void disconnect();
        }
      }, POLL_INTERVAL_MS);
    },
    [disconnect, stopPolling],
  );

  const connect = useCallback(
    async ({ clientId, accessToken, refreshToken }: ConnectArgs) => {
      setIsBusy(true);
      setStatus("connecting");
      setStatusDetail(null);

      try {
        const createRes = await fetch("/api/twitch/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel_id: channel.id }),
        });
        if (!createRes.ok) {
          throw new Error("Could not create a session for this channel.");
        }
        const { session } = (await createRes.json()) as {
          session: TwitchSessionRow;
        };
        shareTokenRef.current = session.share_token;
        triggerRef.current = session.trigger_command;
        successMessageRef.current = session.success_message;
        setTriggerCommand(session.trigger_command);
        setShareUrl(`${window.location.origin}/session/${session.share_token}`);

        // The pasted access token may already be expired (e.g. reused from
        // join-milo-bot's .env, last minted whenever that bot last ran) —
        // try it as-is first, and if Twitch rejects it, refresh once via
        // our server-side proxy before giving up.
        let workingAccessToken = accessToken;
        let validated;
        try {
          validated = await validateTwitchToken(workingAccessToken);
        } catch {
          const refreshRes = await fetch("/api/twitch/token/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          const refreshData = await refreshRes.json();
          if (!refreshRes.ok) {
            throw new Error(
              refreshData.error ??
                "Access token was invalid/expired and refreshing it failed.",
            );
          }
          workingAccessToken = refreshData.access_token;
          validated = await validateTwitchToken(workingAccessToken);
        }

        const authProvider = new BrowserTwitchAuthProvider(clientId, {
          accessToken: workingAccessToken,
          refreshToken,
          scope: validated.scopes,
          expiresIn: null,
          obtainmentTimestamp: Date.now(),
          userId: validated.userId,
        });

        const chatClient = new ChatClient({
          authProvider,
          channels: [channel.twitch_channel],
        });
        chatClientRef.current = chatClient;

        chatClient.onJoin(async (joinedChannel) => {
          if (joinedChannel.replace(/^#/, "") !== channel.twitch_channel) return;
          setStatus("connected");
          await patchSession(session.share_token, { status: "connected" });
          startPolling(session.share_token);
        });

        chatClient.onJoinFailure(async (_joinedChannel, reason) => {
          setStatus("error");
          setStatusDetail(reason);
          await patchSession(session.share_token, {
            status: "error",
            status_detail: reason,
          });
          setIsBusy(false);
        });

        chatClient.onAuthenticationFailure(async (text) => {
          setStatus("error");
          setStatusDetail(text);
          await patchSession(session.share_token, {
            status: "error",
            status_detail: text,
          });
          setIsBusy(false);
        });

        chatClient.onDisconnect(async (manually, reason) => {
          if (manually) return;
          setStatus("error");
          setStatusDetail(reason?.message ?? "Disconnected unexpectedly.");
          await patchSession(session.share_token, {
            status: "error",
            status_detail: reason?.message ?? "Disconnected unexpectedly.",
          });
        });

        chatClient.onMessage(async (chatChannel, user, text, msg) => {
          const trigger = triggerRef.current.trim().toLowerCase();
          if (!text.trimStart().toLowerCase().startsWith(trigger)) return;

          const payload = buildCommandPayload(
            text,
            trigger,
            msg.userInfo.displayName,
          );

          let avatarUrl: string | undefined;
          if (payload.type === "image") {
            avatarUrl = await fetchAvatarUrl(msg.userInfo.userName);
          }

          const body = buildHopeWallBody({
            ...payload,
            avatarUrl,
          });
          const result = shareTokenRef.current
            ? await relayToHopeWall(shareTokenRef.current, body)
            : { ok: false, errorMessage: "No active session." };

          if (result.ok) {
            await chatClient.say(
              chatChannel,
              `@${msg.userInfo.userName} ${successMessageRef.current}`,
            );
          } else {
            await chatClient.say(
              chatChannel,
              `❌ ${result.errorMessage} @${msg.userInfo.userName}`,
            );
          }

          const shareToken = shareTokenRef.current;
          if (shareToken) {
            await fetch(`/api/twitch/sessions/${shareToken}/events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                twitch_username: msg.userInfo.userName,
                display_name: msg.userInfo.displayName,
                raw_message: text,
                content: payload.content,
                message_type: payload.type,
                success: result.ok,
                error_message: result.ok ? null : result.errorMessage,
                wall_message_id: result.ok ? (result.messageId ?? null) : null,
                image_url: payload.type === "image" ? (avatarUrl ?? null) : null,
              }),
            });
          }
        });

        chatClient.connect();
        setIsBusy(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Connection failed.";
        setStatus("error");
        setStatusDetail(message);
        if (shareTokenRef.current) {
          await patchSession(shareTokenRef.current, {
            status: "error",
            status_detail: message,
          });
        }
        setIsBusy(false);
      }
    },
    [channel, startPolling],
  );

  // Safety net for e.g. switching selected channel mid-connection, or
  // navigating away — the chat client and polling must not keep running
  // for an unmounted panel.
  useEffect(() => {
    return () => {
      stopPolling();
      chatClientRef.current?.quit();
      chatClientRef.current = null;
      if (shareTokenRef.current) {
        void patchSession(shareTokenRef.current, { status: "disconnected" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteEvent = useCallback(async (eventId: number): Promise<string | null> => {
    const shareToken = shareTokenRef.current;
    if (!shareToken) return "No active session.";
    const res = await fetch(
      `/api/twitch/sessions/${shareToken}/events/${eventId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return data?.error ?? "Could not delete this message.";
    }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    return null;
  }, []);

  return {
    status,
    statusDetail,
    shareUrl,
    triggerCommand,
    events,
    isBusy,
    connect,
    deleteEvent,
    disconnect,
  };
}
