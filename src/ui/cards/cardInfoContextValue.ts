// React Context value + the `useCardInfo` hook. Lives in its own file
// so the matching `.tsx` only exports the Provider component (Vite
// fast-refresh constraint: a hot-reloadable module must be all
// components).

import { createContext, useContext } from 'react';

export interface CardInfoContextValue {
  /** Whether the relationships modal should be open. Set by `open()`
   *  and `openWithoutFocus()`; cleared by `close()`. */
  isOpen: boolean;
  /** Currently focused card id. `null` when the modal is open via
   *  `openWithoutFocus()` (dev-tab style) or when the modal is closed. */
  focusId: string | null;
  /** Optional sub-id to highlight within the focused card. Used today
   *  for science cards: the in-game card knows which cost variant is
   *  placed in its cell, and threads the variant's id here so the
   *  canonical card view can mark "this is the one in your match". */
  highlightSubId: string | null;
  open: (cardId: string, highlightSubId?: string) => void;
  /** Open the modal without selecting a specific card — used by the
   *  dev sidebar's "Card relationships" entry. */
  openWithoutFocus: () => void;
  close: () => void;
}

export const CardInfoContext = createContext<CardInfoContextValue | null>(null);

/** Returns the context if a provider is mounted, or null otherwise.
 *  Card components use this so the `?` button silently disappears in
 *  environments that didn't wire the modal. */
export const useCardInfo = (): CardInfoContextValue | null =>
  useContext(CardInfoContext);
