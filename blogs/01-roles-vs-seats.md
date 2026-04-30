# Roles vs seats: one indirection, three payoffs

In most boardgame.io games, "player 0" is a complete identity — they have a
hand, a turn, and a view of the board. We needed something looser. The
codenamed **Settlement** game has four *roles* (chief, science, domestic,
foreign) but is meant to play at 1, 2, 3, or 4 players. So we split the
identity in two: a **seat** is a bgio `playerID`; a **role** is a job. One
seat can hold one or more roles depending on the player count.

The whole mapping lives in one table at [src/game/roles.ts:11-30](src/game/roles.ts#L11-L30):

```ts
4: {
  '0': ['chief'],
  '1': ['science'],
  '2': ['domestic'],
  '3': ['foreign'],
},
```

…and at the other extreme, a 1-player solo seat holds all four roles.
Three small helpers — `assignRoles`, `seatOfRole`, `rolesAtSeat` — are
the only things the rest of the codebase imports. That indirection pays
off in three places that would otherwise have hard-coded a player count.

**1. Parallel turns scale to the live seating.** The non-chief phase
runs every other seat in parallel via bgio's `setActivePlayers`. The
stage map is rebuilt from the assignments at `turn.onBegin`
([src/game/phases/stages.ts:55-74](src/game/phases/stages.ts#L55-L74))
— each seat lands in the stage matching its highest-priority non-chief
role, by `science > domestic > foreign`. A 2-player game collapses into
two stages naturally, with no special case in the phase config.

**2. Per-seat redaction follows role membership, not a player count.**
`playerView` resolves *which roles the viewer holds* and redacts every
hand and deck owned by a role they don't
([src/game/playerView.ts:160-171](src/game/playerView.ts#L160-L171)).
A 2-player seat that holds chief+science sees both gold and blue event
hands; the other seat sees green and red. There is no branch on
`numPlayers` anywhere in the redactor.

**3. Bots enumerate moves per role, not per player.** The MCTS / Random
bot's `enumerate(G, ctx, playerID)` looks up the seat's roles and emits
candidate moves for each ([src/game/ai/enumerate.ts](src/game/ai/enumerate.ts)).
A solo 1-player game's bot would, in principle, generate moves for all
four roles in a single `enumerate` call — same code path.

The lesson we keep relearning: **the cheapest abstraction is the one
that names a thing the engine doesn't know about.** bgio knows about
seats. Our game cares about roles. Putting a 25-line file between them
let three otherwise-tangled subsystems stay player-count-agnostic.
