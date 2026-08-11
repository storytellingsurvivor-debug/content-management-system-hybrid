export interface TwitchChannelRow {
  id: string;
  name: string;
  twitch_channel: string;
  happy_wall_id: string;
  target_url: string;
  created_at: string;
  last_used_at: string | null;
}

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface TwitchSessionRow {
  id: string;
  share_token: string;
  channel_id: string;
  trigger_command: string;
  success_message: string;
  status: SessionStatus;
  status_detail: string | null;
  disconnect_requested: boolean;
  created_at: string;
  connected_at: string | null;
  disconnected_at: string | null;
}

export interface TwitchSessionEventRow {
  id: number;
  session_id: string;
  twitch_username: string;
  display_name: string;
  raw_message: string;
  content: string;
  message_type: "image" | "emoji";
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface TwitchSessionView {
  session: TwitchSessionRow;
  channel: TwitchChannelRow;
  events: TwitchSessionEventRow[];
}
