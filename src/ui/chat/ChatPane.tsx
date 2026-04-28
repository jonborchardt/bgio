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

import { useEffect, useRef } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

/** Single chat envelope, narrowed from bgio's `ChatMessage`. We only
 * type the fields the pane reads — the bgio `payload` is `any`. */
export interface ChatMessageView {
  id: string;
  sender: string;
  payload: unknown;
}

export interface ChatPaneProps {
  chatMessages: ReadonlyArray<ChatMessageView>;
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

export function ChatPane({ chatMessages }: ChatPaneProps) {
  // Auto-scroll to bottom whenever the list grows. We anchor on a sentinel
  // div at the end and call `scrollIntoView` — works regardless of the
  // pane's flex/grid context.
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
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
      {chatMessages.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
        >
          No messages yet.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {chatMessages.map((m) => (
            <Box key={m.id}>
              <Typography
                component="span"
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.active,
                  fontWeight: 700,
                  mr: 1,
                }}
              >
                {`P${m.sender}:`}
              </Typography>
              <Typography component="span" variant="body2">
                {extractText(m.payload)}
              </Typography>
            </Box>
          ))}
          <Box ref={endRef} />
        </Stack>
      )}
    </Paper>
  );
}

export default ChatPane;
