// Synthetic target ids for non-card requestable actions.
//
// Card-backed targets reuse the canonical id from `src/cards/registry.ts`
// (`building:Forge`, `tech:Compass`, `unit:Scout`, `science:<canonical>`).
// Anything that isn't a card needs its own stable string.

/** The single trade-request slot on the center mat. There is only ever
 *  one in flight, so a constant is enough. */
export const TRADE_REQUEST_TARGET_ID = 'trade:current';
