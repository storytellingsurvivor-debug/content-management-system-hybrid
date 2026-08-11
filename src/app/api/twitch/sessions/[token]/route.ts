import { getSql } from "@/lib/twitchBotDb";
import type {
  SessionStatus,
  TwitchSessionEventRow,
  TwitchSessionRow,
} from "@/types/twitchBot";

const VALID_STATUSES: SessionStatus[] = [
  "idle",
  "connecting",
  "connected",
  "disconnected",
  "error",
];

// This route is the entire access model for a session: knowing the
// share_token is what grants access, nothing else gates it. It must never
// support listing/enumeration — only exact-token lookup — and the response
// deliberately omits channel.target_url / channel.happy_wall_id, which
// aren't needed to view or moderate a session.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const sql = getSql();

  const [row] = (await sql`
    select
      s.id, s.share_token, s.channel_id, s.trigger_command, s.success_message,
      s.status, s.status_detail, s.disconnect_requested, s.created_at,
      s.connected_at, s.disconnected_at,
      c.name as channel_name, c.twitch_channel
    from sessions s
    join channels c on c.id = s.channel_id
    where s.share_token = ${token}
  `) as Array<
    TwitchSessionRow & { channel_name: string; twitch_channel: string }
  >;

  if (!row) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const events = (await sql`
    select id, session_id, twitch_username, display_name, raw_message,
      content, message_type, success, error_message, created_at
    from session_events
    where session_id = ${row.id}
    order by created_at desc
    limit 200
  `) as TwitchSessionEventRow[];

  return Response.json({
    session: {
      id: row.id,
      share_token: row.share_token,
      channel_id: row.channel_id,
      trigger_command: row.trigger_command,
      success_message: row.success_message,
      status: row.status,
      status_detail: row.status_detail,
      disconnect_requested: row.disconnect_requested,
      created_at: row.created_at,
      connected_at: row.connected_at,
      disconnected_at: row.disconnected_at,
    },
    channel: {
      name: row.channel_name,
      twitch_channel: row.twitch_channel,
    },
    events,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const body = await request.json();

  const hasTrigger = typeof body.trigger_command === "string";
  const triggerCommand = hasTrigger
    ? String(body.trigger_command).trim().toLowerCase()
    : null;
  if (hasTrigger && !triggerCommand) {
    return Response.json(
      { error: "trigger_command cannot be empty." },
      { status: 400 },
    );
  }

  const hasSuccessMessage = typeof body.success_message === "string";
  const successMessage = hasSuccessMessage
    ? String(body.success_message).trim()
    : null;

  const hasStatus = typeof body.status === "string";
  if (hasStatus && !VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }
  const status = hasStatus ? (body.status as SessionStatus) : null;
  const statusDetail = hasStatus
    ? typeof body.status_detail === "string"
      ? body.status_detail
      : null
    : undefined;

  const hasDisconnectRequested = typeof body.disconnect_requested === "boolean";
  const disconnectRequested = hasDisconnectRequested
    ? (body.disconnect_requested as boolean)
    : null;

  const sql = getSql();
  const [updated] = (await sql`
    update sessions set
      trigger_command = coalesce(${triggerCommand}, trigger_command),
      success_message = coalesce(${successMessage}, success_message),
      status = coalesce(${status}, status),
      status_detail = case when ${hasStatus} then ${statusDetail ?? null} else status_detail end,
      disconnect_requested = coalesce(${disconnectRequested}, disconnect_requested),
      connected_at = case when ${status} = 'connected' then now() else connected_at end,
      disconnected_at = case when ${status} in ('disconnected', 'error') then now() else disconnected_at end
    where share_token = ${token}
    returning id, share_token, channel_id, trigger_command, success_message,
      status, status_detail, disconnect_requested, created_at, connected_at, disconnected_at
  `) as TwitchSessionRow[];

  if (!updated) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  return Response.json({ session: updated });
}
