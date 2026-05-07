// Issue 002 — Match-move authentication hook for bgio's Server.
//
// bgio's `Server({ authenticateCredentials })` is the integration point for
// gating moves: the Auth class invokes the user-supplied hook on every
// `MAKE_MOVE` with `(credentials, playerMetadata)` (positional). Returning
// falsy rejects the move with bgio's standard `"unauthorized"` error.
//
// We layer two concerns on top of bgio's default credentials match:
//
//   1. **Standard human flow**: the lobby `joinMatch` call returns a
//      `playerCredentials` token that bgio stores at
//      `metadata.players[id].credentials`. We accept the move when the
//      submitted `credentials` matches the stored token. (Same as bgio's
//      built-in default — `areCredentialsAuthentic`.)
//
//   2. **Bot bypass**: server-side bots (driven by `server/bots/botDriver.ts`)
//      submit a synthetic `bot:<seat>` credential. We honor it only when
//      `metadata.players[id].isBot === true`, so a network adversary can't
//      impersonate a bot that isn't marked.
//
// Spectators (playerID === null) never reach this hook — bgio short-circuits
// authentication for them via `playerView`.
//
// **Signature note.** bgio's Auth class invokes the user hook positionally
// as `(credentials, playerMetadata)`. The `playerMetadata` is one seat's
// metadata (the row from `metadata.players[playerID]`), not the full match
// metadata. The `id` field on the row tells us which seat.

/** Synthetic credential pattern submitted by `botDriver`. */
export const BOT_CREDENTIAL_PREFIX = 'bot:';

/** Build a bot credential for a given seat. Tied to the playerID so a
 * leaked bot credential for one seat can't impersonate another. */
export const botCredentialsFor = (playerID: string): string =>
  `${BOT_CREDENTIAL_PREFIX}${playerID}`;

/** bgio's `Server.PlayerMetadata` shape, plus the `isBot` field bgio
 * stores per-player but doesn't surface in the type. */
interface PlayerMetadataEntry {
  id: number | string;
  credentials?: string;
  isBot?: boolean;
  name?: string;
  data?: unknown;
  isConnected?: boolean;
}

/** bgio Auth invokes this with `(credentials, playerMetadata)`. */
export const authenticateCredentials = (
  credentials: string | undefined,
  playerMetadata: PlayerMetadataEntry | undefined,
): boolean => {
  if (!playerMetadata) {
    // bgio returns the metadata for the named seat; if it's missing,
    // there's no seat to authenticate against. Reject.
    return false;
  }

  if (playerMetadata.isBot === true) {
    // Bot seats authenticate ONLY via the synthetic bot credential tied
    // to this exact seat. We never fall through to the dev-mode accept
    // for bot seats — that would let a network adversary submit any
    // credential and impersonate the bot.
    return (
      typeof credentials === 'string' &&
      credentials === botCredentialsFor(String(playerMetadata.id))
    );
  }

  // Standard human flow: bgio's default behavior is to accept when the
  // stored credentials match. We mirror that, but allow the dev-mode
  // case where the seat hasn't been issued credentials yet (joinMatch
  // skipped) so unauthenticated clients keep working in dev. A console
  // warning surfaces it for production deploys to scrape.
  if (playerMetadata.credentials === undefined || playerMetadata.credentials === null) {
    if (!credentials) {
      console.warn(
        `[auth] move from playerID=${String(playerMetadata.id)} without credentials; seat has no stored token (dev-mode join).`,
      );
    }
    return true;
  }

  return playerMetadata.credentials === credentials;
};
