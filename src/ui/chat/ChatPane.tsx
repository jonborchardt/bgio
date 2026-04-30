// ChatPane (10.5) — renders bgio's built-in chat channel.
//
// bgio's React `Client` exposes `chatMessages` and `sendChatMessage` as
// props on the wrapped board (see boardgame.io/dist/types/src/client/
// react.d.ts: `BoardProps` includes both). This pane is a pure read of
// that array — no plugin, no game-state slice, no custom move.
//
// We extract the payload's `text` field if present (our `ChatPayload`
// shape is `{ text, ts }`) and fall back to a JSON dump for anything
// else, so a stray sender that forgot the shape still renders something
// debuggable.

import { useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Role } from '../../game/types.ts';

/** Single chat envelope, narrowed from bgio's `ChatMessage`. We only
 * type the fields the pane reads — the bgio `payload` is `any`. */
export interface ChatMessageView {
  id: string;
  sender: string;
  payload: unknown;
}

export interface ChatPaneProps {
  chatMessages: ReadonlyArray<ChatMessageView>;
  /** Optional sender-label resolver — e.g. `'0' -> 'Chief (P1)'`. Defaults
   * to `P{1+n}` when not supplied so the pane keeps working without role
   * context (tests, future spectator views, etc.). */
  formatSender?: (sender: string) => string;
  /** Optional sender → primary `Role` resolver. When provided, the sender
   * label is colored with `palette.role[role].main`; otherwise the label
   * falls back to `palette.status.active`. ChatSection wires this from
   * `roleAssignments` (the first role at the sender's seat). */
  senderRole?: (sender: string) => Role | undefined;
}

const extractText = (payload: unknown): string => {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'text' in payload &&
    typeof (payload as { text?: unknown }).text === 'string'
  ) {
    return (payload as { text: string }).text;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const defaultFormat = (sender: string): string => {
  const n = Number(sender);
  return Number.isFinite(n) ? `P${n + 1}` : sender;
};

export function ChatPane({
  chatMessages,
  formatSender,
  senderRole,
}: ChatPaneProps) {
  const fmt = formatSender ?? defaultFormat;
  // Newest messages render at the top of the pane, so the latest entry is
  // visible without scrolling. We reverse a copy so we don't mutate the
  // caller's array.
  const ordered = useMemo(
    () => [...chatMessages].reverse(),
    [chatMessages],
  );
  // When the list grows, the newest row sits at the top of the scrollable
  // area — snap the pane to its top so the user sees the new message even
  // if they had scrolled down to read older history.
  const topRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [chatMessages.length]);

  return (
    <Paper
      elevation={0}
      aria-label="Chat messages"
      sx={{
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        borderRadius: 1,
        p: 1.5,
        maxHeight: '12rem',
        overflowY: 'auto',
      }}
    >
      {ordered.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
        >
          No messages yet.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          <Box ref={topRef} />
          {ordered.map((m) => {
            const role = senderRole?.(m.sender);
            return (
              <Box key={m.id}>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    color: (t) =>
                      role !== undefined
                        ? t.palette.role[role].main
                        : t.palette.status.active,
                    fontWeight: 700,
                    mr: 1,
                  }}
                >
                  {`${fmt(m.sender)}:`}
                </Typography>
                <Typography component="span" variant="body2">
                  {extractText(m.payload)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

export default ChatPane;
