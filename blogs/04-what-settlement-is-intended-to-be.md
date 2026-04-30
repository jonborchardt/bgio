# What Settlement is intended to be

Settlement is a cooperative strategy game where one to four players
share four roles. One human plays all four. Two humans split them. Four
humans take one each. Bots fill whatever seats the humans don't. It's
the *same game* at any player count, not a solo variant grafted onto a
multiplayer one.

That single premise — same game, any seat count — is what the rest of
the design has to earn.

## The shape of a round

Each round walks through three phases. The **chief** opens by
redistributing the shared bank of resources to the other roles. Then
the **other three roles act in parallel** — science, domestic, and
foreign each take their stage at the same time, not in turn order.
Then end-of-round bookkeeping runs and the next round begins. The win
condition is ten competing settlements joining yours, by tribute or by
force. There is no lose condition.

The four roles are four mechanically different mini-games:

- **Chief** redistributes the bank and sets the round's economic shape.
- **Science** excavates a grid of tech cards by paying their cost — a
  market-style draft borrowing from Splendor and 7 Wonders.
- **Domestic** builds an adjacency-driven grid of buildings that
  produces resources back into the bank — Carcassonne / Suburbia
  territory.
- **Foreign** fights a battle deck with a hand of units, in an MTG /
  Star Realms idiom.

Each role has its own grain: its own decisions, its own resource
relationship, its own pace.

## Why this shape

The reason the four roles are mechanically different — instead of all
four playing the same kind of turn from different angles — is that **a
solo player owns all four**. If the roles shared one mechanic, a solo
game would be four iterations of the same decision. Instead it's four
different decisions per round, each pulling from a different design
tradition. The hand-off between roles becomes the texture of the game.

The flip side is the **co-op-against-the-world stance with no fail
mode**. All players — human or bot — win or lose together; pressure
comes from an opponent deck and a battle deck that scale with progress,
but a bad round costs tempo, not the match. We give up the climactic
arc of a "you almost lost" finish and get back the freedom to design
pressure systems that don't have to be calibrated to "exactly hard
enough to maybe kill you." Pressure can degrade outcomes instead of
ending them.

The parallel non-chief phase is what makes the player-count flexibility
work in practice. With four humans, nobody waits three turns to act.
With one human, the same engine just runs the three stages
back-to-back. Same code path, different active-player set.

## The web that makes the roles need each other

The four roles aren't just stylistically different — their content is
wired together so that progress in one role unlocks options in
another. The science color of a tech card decides which role's hand
it ends up in, but every tech in the deck names what it unlocks for
*everyone*.

Here's the Foreign side of the deck, the chain a player follows to
field a Sniper:

```
Stick fighting (free) ──▶ Spearman, Stick Fighter, Shield Bearer
                      └─▶ Tactics ──▶ Drill Yard, Standard Bearer
                                  ├─▶ Phalanx ──▶ Pikeman, Halberdier
                                  └─▶ Discipline ──▶ Shock Troops ──▶ Berserker

metalworking ──┬─▶ Knives ──▶ Knife Fighter, Cutter
               │           └─▶ Smelting ──▶ Forge, Ironworks
               ├─▶ Armor ──▶ Plate Armor ──▶ Heavy Cavalry, Paladin
               └─▶ Bullet manufacturing ──▶ Small guns ──▶ Riflery ──▶ Rifle Squad
                                                       └─▶ Sniping ──▶ Sniper
```

A Sniper isn't a button you press — it's a project. To recruit one you
needed Sniping; Sniping needed Small guns + Camo; Small guns needed
Knives + Bullet manufacturing; Bullet manufacturing needed Factory
working + Chemistry. Chemistry comes from the Education tree.
Factory working comes from the Civic tree. So fielding a Sniper
visibly involves three other roles having pulled their weight. A
unit on the table is a paragraph of history.

Education is the cross-role tech tree that ties the others together:

```
Reading (free) ──▶ Writing ──▶ Library ──▶ Pedagogy ──▶ School
              └─▶ Math ──▶ Geometry ──▶ Architecture ──▶ Cathedral, Palace
                       ├─▶ Physics ──▶ Mechanics ──▶ Crossbowman (Foreign!)
                       │           └─▶ Optics ──▶ Camo Sniper (Foreign!)
                       │           └─▶ Fix electronics ──▶ Recon Drone
                       └─▶ Logic patterns
First Aid (free) ──▶ Medicine ──▶ Anatomy ──▶ Witch Doctor (Foreign!)
              └─▶ Chemistry ──▶ Bombs ──▶ Demolitions ──▶ Sapper, Bazooka
              └─▶ Biology ──▶ Botany ──▶ Apiary (Domestic!)
```

A Sapper unit can't exist on the Foreign side until Education has
done Chemistry, which fed Fighting's Bombs, which fed Demolitions. A
Camo Sniper requires Optics (Education) plus Sniping + Camo
(Fighting). The Apiary that feeds the Domestic food economy comes
out of Botany. This is the lever that prevents any one role from
being tech-isolated: Science can hand a tech to Domestic that
Domestic uses to unlock a building Foreign needs to recruit a unit
that wins next round's battle.

## Is it novel?

Cautiously: yes, in one specific respect.

Co-op board games scale by adding seats and dividing the roster.
Solo-friendly games usually offer a "solo variant" that simplifies or
re-skins the multiplayer rules. Settlement instead treats *seats* and
*roles* as separate axes — there are always four roles in play, and
the player count only decides who runs which ones. A 1-player game and
a 4-player game are running the *same* turn structure with the *same*
phases and the *same* card counts. A `Record<seat, Role[]>` mapping is
the only thing that changes between configurations.

What that buys is a co-op whose mechanical surface area doesn't shrink
when you play alone and doesn't bloat when you play with friends. The
cost is that each role has to be lean enough that one person can hold
all four without decision fatigue, and rich enough that a single role
is satisfying in a four-human game. A 20–60 minute target round, ~58
buildings, ~82 tech cards, and ~67 units are all sized against that
constraint — deep enough that no two games look the same, shallow
enough that one human can hold all four roles in their head.

I wouldn't claim this is unprecedented — co-ops with role asymmetry
exist, and games scale with bots in plenty of digital implementations.
But the combination — *four distinct mini-games unified by a shared
bank and a shared tech web, scaled by remapping roles to seats rather
than by simplifying the ruleset* — is the bet this project is making.

## A bit on the tech

Settlement is built on **boardgame.io**, with React + TypeScript on
the front end and a Koa server on the back. The whole thing ships out
of a single Vite app.

A few choices worth calling out:

- **The engine *is* the engine.** boardgame.io's phases, parallel
  active players, plugin system, secret-state redaction, lobby, chat,
  and bot framework do the heavy lifting. Where it falls short, we
  layer thin shells on top — a custom plugin, a wrapper component —
  rather than replace the built-in. The premise of the project is
  that we accept some glue in exchange for not maintaining a parallel
  game framework.
- **Two builds, one game.** The networked build talks to the Koa
  server over SocketIO and is the primary delivery target. A hot-seat
  build wires the same game into a `Local` transport for single-tab
  play and quick QA. Same game logic, different transport — the game
  module is React-free so it can run headless for tests, replays, and
  bots.
- **Bots run server-side.** Each role exposes an `ai.enumerate` that
  the server's bot driver consumes. A 1-human game and a 4-human game
  are the same server process; the only difference is which seats have
  human credentials.
- **Determinism.** All randomness goes through the engine's random
  plugin. `Math.random` is lint-banned in game code so a match's
  history is enough to replay it exactly.
- **MUI for the UI.** A single theme file owns every color, spacing
  token, and per-role accent. There's no parallel CSS system and no
  raw hex literals in components — the lint bar is "designer changes
  one file."

The deeper bet, restated in engineering terms: a co-op whose
mechanical surface area is the same at one and four players is,
structurally, four small games that share a bank. The role/seat
indirection, the no-fail-mode stance, the parallel non-chief phase,
and the server-driven bots are the same idea seen from four sides —
keep the four mini-games whole, and let the player count decide who
runs which one.
