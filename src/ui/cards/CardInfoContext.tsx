// CardInfoProvider — owns the modal-focus state. The context object
// + `useCardInfo` hook live in a separate `.ts` file so this module
// only exports the provider component (keeps Vite fast-refresh happy).

import { useCallback, useState } from 'react';
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
  return (
    <CardInfoContext.Provider
      value={{ isOpen, focusId, highlightSubId, open, openWithoutFocus, close }}
    >
      {children}
    </CardInfoContext.Provider>
  );
};
