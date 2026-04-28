// ChatComposer (10.5) — text field + send button that calls into
// bgio's built-in `client.sendChatMessage(payload)`. The composer is
// intentionally dumb: it doesn't know about the bgio Client. Parent
// (Board.tsx) wires `onSend(text) => props.sendChatMessage({ text, ts })`.
//
// Length / trim / empty-state guards live here, not in a server-side
// move — bgio's chat transport accepts any serializable payload, and
// per the plan "length / content limits go in the composer".

import { useCallback, useState, type KeyboardEvent } from 'react';
import { Button, Stack, TextField } from '@mui/material';

const MAX_LEN = 280;

export interface ChatComposerProps {
  onSend: (text: string) => void;
  /** Optional disabler — e.g. spectators can't post. Off by default. */
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled = false }: ChatComposerProps) {
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LEN && !disabled;

  const send = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setText('');
  }, [canSend, onSend, trimmed]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Enter to send (no Shift+Enter for newline; chat is single-line for V1).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField
        size="small"
        value={text}
        onChange={(e) => {
          // Clamp at the input boundary so the user can't paste 5KB.
          const next = e.target.value;
          setText(next.length > MAX_LEN ? next.slice(0, MAX_LEN) : next);
        }}
        onKeyDown={onKeyDown}
        placeholder="Say something…"
        disabled={disabled}
        slotProps={{ htmlInput: { 'aria-label': 'Chat message' } }}
        sx={{ flex: 1 }}
      />
      <Button variant="contained" onClick={send} disabled={!canSend}>
        Send
      </Button>
    </Stack>
  );
}

export default ChatComposer;
