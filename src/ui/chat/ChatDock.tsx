// ChatDock — single chat surface, same on desktop and mobile.
//
// One `<Drawer anchor="right">` plus one `<Fab>` that toggles it.
// The drawer overlays the play area when open and is hidden when
// closed; the FAB carries a per-seat unread-count badge.
//
// "Unread" is scoped to the local seat — in hot-seat play that means
// each tab maintains its own last-seen marker, so when a player
// switches seats the badge reflects what THAT seat hasn't seen, not
// a single global count. We persist the marker in `localStorage` so
// a page reload doesn't reset everyone to "0 unread" and silently
// drop messages they should still be alerted to.
//
// We deliberately don't fork by breakpoint — the desktop "permanent
// rail" + mobile "drawer" split duplicated state and lost ChatSection's
// optimistic outbox on resize. A single overlay drawer behaves the
// same at every width, and the Board no longer reserves a sidebar
// column.

import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Drawer,
  Fab,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { ChatSection, type ChatSectionProps } from './ChatSection.tsx';

export interface ChatDockProps extends ChatSectionProps {}

const ChatGlyph = () => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{ width: 24, height: 24, display: 'block' }}
    aria-hidden
  >
    <path
      fill="currentColor"
      d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"
    />
  </Box>
);

const CloseGlyph = () => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{ width: 18, height: 18, display: 'block' }}
    aria-hidden
  >
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
  </Box>
);

// Per-seat last-seen marker. Keyed by local seat string ('0'..'3', or
// the empty string for spectators / unseated). Persisted in
// localStorage so a reload doesn't lose the read state.
// Bumped to v2: v1 left every seat seeded as "caught up" with the
// current totalCount on first encounter, which silently zeroed out
// any unread count on hot-seat tab swaps. Existing v1 data is
// ignored so dev sessions don't carry over the bad state.
const STORAGE_KEY = 'settlement.chatSeenBySeat.v2';

const loadSeenBySeat = (): Record<string, number> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

const saveSeenBySeat = (m: Record<string, number>): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // localStorage write failed (private mode, quota) — silently drop;
    // unread will just reset to "all messages" on next reload.
  }
};

export function ChatDock(props: ChatDockProps) {
  const [open, setOpen] = useState(false);
  // `mergedCount` is the count ChatSection actually renders — bgio's
  // chatMessages PLUS the local optimistic outbox. In hot-seat the
  // bgio Local transport can swallow echoes, so reading raw
  // `chatMessages.length` here would leave the FAB at 0 unread even
  // after the player clearly sent a message. ChatSection feeds the
  // merged count up via `onMergedCountChange`.
  const [mergedCount, setMergedCount] = useState(props.chatMessages.length);
  // Defensive: if ChatSection hasn't fired yet (or this dock is
  // rendered without one for some reason), fall back to the bgio
  // length so we never show negative unread.
  const totalCount = Math.max(mergedCount, props.chatMessages.length);

  // Unread is computed against the *local* seat — the seat the viewer
  // currently controls. Hot-seat tab swaps re-key the lookup so the
  // badge reflects the current seat's read state.
  const seatKey =
    typeof props.localSender === 'string' && props.localSender.length > 0
      ? props.localSender
      : '_spectator';

  const [seenBySeat, setSeenBySeat] = useState<Record<string, number>>(() =>
    loadSeenBySeat(),
  );

  // A seat that hasn't been viewed yet defaults to seenCount=0 — all
  // existing messages count as unread. This is what makes hot-seat
  // work: when the user switches to a fresh seat, the FAB shows the
  // count of messages sent while that seat was idle. (The earlier
  // "seed to current totalCount" logic silently treated every brand-
  // new seat as caught up, which hid unread messages on tab swap.)
  const seenCount = seenBySeat[seatKey] ?? 0;
  const unread = Math.max(0, totalCount - seenCount);

  // While the drawer is open, mark new arrivals as already seen for
  // THIS seat so the badge stays at zero (no flicker) and other
  // seats' unread counts are unaffected. Only ratchet upward — under
  // StrictMode dev double-mount the effect can otherwise momentarily
  // write a lower value and lose unread state.
  useEffect(() => {
    if (!open) return;
    setSeenBySeat((prev) => {
      const current = prev[seatKey] ?? 0;
      if (current >= totalCount) return prev;
      const next = { ...prev, [seatKey]: totalCount };
      saveSeenBySeat(next);
      return next;
    });
  }, [open, totalCount, seatKey]);

  return (
    <>
      <Fab
        aria-label={
          unread > 0 ? `Open chat (${unread} unread)` : 'Open chat'
        }
        onClick={() => setOpen(true)}
        color="primary"
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 1200,
        }}
      >
        <Badge
          color="error"
          badgeContent={unread}
          invisible={unread === 0}
          overlap="circular"
        >
          <ChatGlyph />
        </Badge>
      </Fab>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        // Keep the inner ChatSection mounted across drawer open/close
        // cycles so its optimistic outbox state survives.
        keepMounted
        slotProps={{
          paper: {
            sx: {
              width: { xs: '90vw', sm: 380 },
              p: 1.5,
              bgcolor: (t) => t.palette.card.surface,
            },
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Chat
          </Typography>
          <IconButton
            aria-label="Close chat"
            size="small"
            onClick={() => setOpen(false)}
          >
            <CloseGlyph />
          </IconButton>
        </Stack>
        <ChatSection {...props} onMergedCountChange={setMergedCount} />
      </Drawer>
    </>
  );
}

export default ChatDock;
