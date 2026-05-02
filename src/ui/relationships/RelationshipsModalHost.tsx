// Mounts the relationships modal driven by CardInfoContext.
//
// The context's `isOpen` flag is set by either path:
//   - any card's `?` button → `cardInfo.open(cardId)`
//   - the dev sidebar       → `cardInfo.openWithoutFocus()`
//
// `matchState` is forwarded to the modal so per-match relationships
// (currently: `science-rewards-tech` from `G.science.underCards`)
// reflect this game's actual cell→tech assignment instead of the
// depth-derivation fallback.

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
