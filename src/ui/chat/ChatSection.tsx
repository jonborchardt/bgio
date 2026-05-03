// ChatSection — wires ChatPane + ChatComposer to bgio's chat channel and
// adds an optimistic local outbox so the sender sees their own message
// even when the transport's echo is delayed, dropped, or duplicated.
//
// Why an outbox at all: bgio's Local transport keys broadcast callbacks
// by playerID; in hot-seat we drive multiple seats from one Client, and
// `client.updatePlayerID()` accumulates callbacks rather than replacing
// them. That can either swallow a message (if the registered callback
// for the current seat lags) or echo it twice. Tracking sent messages
// locally and deduping by `(sender, payload.ts, payload.text)` makes
// the pane's display robust to either failure mode without changing
// bgio's transport.
//
// We dedupe the merged list so a duplicated echo doesn't render twice.

import { useEffect, useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import { ChatPane, type ChatMessageView } from './ChatPane.tsx';
import { ChatComposer } from './ChatComposer.tsx';
import { rolesAtSeat } from '../../game/roles.ts';
import type { PlayerID, Role } from '../../game/types.ts';

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

interface ChatPayload {
  text: string;
  ts: number;
}

const isChatPayload = (p: unknown): p is ChatPayload =>
  p !== null &&
  typeof p === 'object' &&
  typeof (p as { text?: unknown }).text === 'string' &&
  typeof (p as { ts?: unknown }).ts === 'number';

const messageKey = (m: ChatMessageView): string => {
  if (isChatPayload(m.payload)) {
    return `${m.sender}|${m.payload.ts}|${m.payload.text}`;
  }
  return `${m.sender}|${m.id}`;
};

export interface ChatSectionProps {
  chatMessages: ReadonlyArray<ChatMessageView>;
  sendChatMessage?: (payload: ChatPayload) => void;
  /** Local seat — used to label optimistic entries before bgio echoes them. */
  localSender?: string | null;
  /** Seat -> role mapping so the pane can label senders as
   * `Chief (P1)` etc. Falls back to `P{n}` when missing. */
  roleAssignments?: Record<PlayerID, Role[]>;
  /** Fires whenever the merged (bgio + optimistic outbox) message
   *  count changes. ChatDock uses this for the FAB unread badge —
   *  in hot-seat, bgio's Local transport can swallow echoes, so
   *  `chatMessages.length` alone undercounts what the player has
   *  actually sent. Including the outbox keeps the badge accurate. */
  onMergedCountChange?: (n: number) => void;
}

export function ChatSection({
  chatMessages,
  sendChatMessage,
  localSender,
  roleAssignments,
  onMergedCountChange,
}: ChatSectionProps) {
  const formatSender = useMemo(() => {
    return (sender: string): string => {
      const n = Number(sender);
      const seatLabel = Number.isFinite(n) ? `P${n + 1}` : sender;
      if (!roleAssignments) return seatLabel;
      const roles = rolesAtSeat(roleAssignments, sender);
      if (roles.length === 0) return seatLabel;
      const roleText = roles.map((r) => ROLE_LABEL[r]).join('/');
      return `${roleText} (${seatLabel})`;
    };
  }, [roleAssignments]);
  // Primary role at a seat — used by ChatPane to color the sender label
  // with the per-role palette accent. When a seat holds multiple roles
  // (1/2/3-player layouts) we color by the first one; the label text
  // still names them all.
  const senderRole = useMemo(() => {
    return (sender: string): Role | undefined => {
      if (!roleAssignments) return undefined;
      const roles = rolesAtSeat(roleAssignments, sender);
      return roles[0];
    };
  }, [roleAssignments]);
  const [outbox, setOutbox] = useState<ChatMessageView[]>([]);

  useEffect(() => {
    if (outbox.length === 0) return;
    const echoed = new Set(chatMessages.map(messageKey));
    setOutbox((prev) => prev.filter((m) => !echoed.has(messageKey(m))));
  }, [chatMessages, outbox.length]);

  const handleSend = (text: string) => {
    if (sendChatMessage === undefined) return;
    const payload: ChatPayload = { text, ts: Date.now() };
    sendChatMessage(payload);
    setOutbox((prev) => [
      ...prev,
      {
        id: `local-${payload.ts}-${prev.length}`,
        sender: localSender ?? '?',
        payload,
      },
    ]);
  };

  const seen = new Set<string>();
  const merged: ChatMessageView[] = [];
  for (const m of chatMessages) {
    const k = messageKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(m);
  }
  for (const m of outbox) {
    const k = messageKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(m);
  }

  const mergedCount = merged.length;
  useEffect(() => {
    onMergedCountChange?.(mergedCount);
  }, [mergedCount, onMergedCountChange]);

  return (
    <Stack component="section" aria-label="Chat" spacing={1}>
      <ChatPane
        chatMessages={merged}
        formatSender={formatSender}
        senderRole={senderRole}
      />
      <ChatComposer
        onSend={handleSend}
        disabled={sendChatMessage === undefined}
      />
    </Stack>
  );
}

export default ChatSection;
