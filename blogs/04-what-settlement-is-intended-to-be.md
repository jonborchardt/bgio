# What Settlement is intended to be

Settlement is a cooperative strategy game where one human plays four
roles' worth of decisions, with bots filling whatever seats the human
doesn't. Or two humans split the roles. Or four humans take one each.
Same game, remapped.

That premise — "same game at any player count" — is the constraint every
other design choice has to defend.

**The four roles are four different mini-games.** Chief redistributes
the shared bank of resources to the other roles each round. Science
excavates a grid of tech cards by paying their cost. Domestic builds an
adjacency-driven grid of buildings that produces resources back into the
bank. Foreign fights a deck of battle cards with a hand of units. Each
role is its own mechanical idiom, borrowed from a different family of
games — the influence list in
[src/data/game-design.md](src/data/game-design.md) has Dominion / 7
Wonders / Splendor for science, Carcassonne / Suburbia for domestic, MTG
/ Star Realms for foreign, Race for the Galaxy for chief.

The reason each role is its own thing — instead of all four playing the
same kind of turn — is that **a 1-player seat owns all four roles**. If
they shared one mechanic, solo would be four turns of the same game.
Instead it's four different decisions, each with its own grain. The
seat / role split — `Record<PlayerID, Role[]>` in
[src/game/types.ts](src/game/types.ts), with `assignRoles` in
[src/game/roles.ts](src/game/roles.ts) doing the player-count-to-role
mapping — is the engineering shape of this design choice.

**Co-op against the world, no fail mode.** All players — human or bot —
win or lose together. The win condition is ten competing settlements
joining you, by tribute or by force. The lose side doesn't exist:
[src/game/endConditions.ts](src/game/endConditions.ts) only encodes
wins. Pressure comes from a wander deck of opponent events and a battle
deck that scales, but a bad round costs you tempo, not the match. We
accepted that this makes the arc less *climactic*; we get back the
freedom to design pressure mechanics that don't have to be calibrated
to "exactly hard enough to maybe kill you".

**Default = 4 players, 1 human + 3 bots.** The bot count is the only
knob. UI decisions assume per-player views and per-player credentials
(see "Project stance" in [CLAUDE.md](CLAUDE.md)), and bots run
server-side via bgio's `Server({ bots })` driven by each role's
`ai.enumerate(G, ctx, playerID)`. There is no separate "solo mode" — a
1-player game is just a single seat holding all four roles, same code
path as a 4-human game.

**A round, not a turn.** The phase loop is chief → others (parallel) →
end-of-round. The non-chief phase uses bgio's `setActivePlayers` so the
other three roles act concurrently. A 4-human game doesn't serialize
into "wait for the other three"; a solo player runs through the three
stages back-to-back. Same engine config, different active-player set.

**20–60 minutes.** Card counts (~40 buildings, 92 science, 20 units, 32
events, 48 opponent, ~24 wander) are sized to that window — not so deep
that a solo player decision-fatigues their way through four roles, not
so shallow that four humans race the deck.

What Settlement is *not*:

- Not competitive — no comparing settlements between players.
- Not a sandbox — the win condition is fixed at ten merged settlements.
- Not "bots play for you" — a solo player makes every decision; bots
  only fill empty seats.
- Not real-time — the parallel non-chief phase is a coordination tool,
  not a clock.
- Not *Settlers of Catan*. "Settlement" is a codename; a real name lands
  when the user picks one.

The deeper bet: **a co-op whose mechanical surface area is the same at
1 and 4 players is, structurally, four small games that share a bank.**
The role / seat indirection, the no-fail-mode stance, the parallel
non-chief phase, and the per-role bots are all the same idea seen from
four sides — keep the four mini-games whole, and let the player count
decide who runs which one.
