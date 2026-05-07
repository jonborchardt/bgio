// Mounts the relationships modal driven by CardInfoContext.
//
// The context's `isOpen` flag is set by either path:
//   - any card's `?` button → `cardInfo.open(cardId)`
//   - the dev sidebar       → `cardInfo.openWithoutFocus()`
//
// `matchState` is forwarded to the modal as a hook for future
// per-match relationships. Today no per-match edges are emitted.

import { useCardInfo } from '../cards/cardInfoContextValue.ts';
import { RelationshipsModal } from './RelationshipsModal.tsx';
import type { MatchStateForGraph } from '../../cards/relationships.ts';

export interface RelationshipsModalHostProps {
  matchState?: MatchStateForGraph;
}

export function RelationshipsModalHost({
  matchState,
}: RelationshipsModalHostProps) {
  const ctx = useCardInfo();
  if (!ctx) return null;
  // Issue 028 — keep the modal mounted across open/close so MUI's
  // Dialog fade-out transition can run; the graph-build cost is
  // avoided inside `RelationshipsModal` itself, which short-circuits
  // when `open === false`.
  return (
    <RelationshipsModal
      open={ctx.isOpen}
      onClose={ctx.close}
      focusId={ctx.focusId}
      matchState={matchState}
    />
  );
}

export default RelationshipsModalHost;
