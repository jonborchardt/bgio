// CardInfoProvider — owns the modal-focus state. The context object
// + `useCardInfo` hook live in a separate `.ts` file so this module
// only exports the provider component (keeps Vite fast-refresh happy).

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CardInfoContext } from './cardInfoContextValue.ts';

export const CardInfoProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [highlightSubId, setHighlightSubId] = useState<string | null>(null);
  const open = useCallback((cardId: string, sub?: string) => {
    setFocusId(cardId);
    setHighlightSubId(sub ?? null);
    setIsOpen(true);
  }, []);
  const openWithoutFocus = useCallback(() => {
    setFocusId(null);
    setHighlightSubId(null);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setFocusId(null);
    setHighlightSubId(null);
  }, []);
  // Issue 026 — memoize the context value so every parent re-render
  // doesn't churn every `useCardInfo()` consumer (the `?` button on
  // every card subscribes). The setters above are already stable
  // (empty `useCallback` deps); the only fields that move are the
  // three pieces of useState state.
  const value = useMemo(
    () => ({ isOpen, focusId, highlightSubId, open, openWithoutFocus, close }),
    [isOpen, focusId, highlightSubId, open, openWithoutFocus, close],
  );
  return (
    <CardInfoContext.Provider value={value}>
      {children}
    </CardInfoContext.Provider>
  );
};
