# Replacing the battle deck

The last post described **Foreign** as the fourth role: a hand of units,
a battle deck, an MTG / Star Realms idiom. That role doesn't exist
anymore. The fourth role is **Defense**, and the battle deck has been
replaced by something we call the **Global Event Track**. The Science
role got a parallel rework at the same time.

This post is a record of what changed and why.

## What was wrong with the battle deck

The battle deck was the most "borrowed" piece of the original design. A
deck shuffles, you draw a card, you fight it, you take damage or you
don't. Stylistically it was distinct from the other three roles —
chief redistributes, science excavates, domestic builds spatial — but
mechanically it was the most familiar. It also had two structural
problems we kept hitting:

1. **It didn't talk to Domestic's grid.** The Domestic role builds an
   adjacency-driven map of buildings. Foreign fought a deck with units.
   The two roles shared a bank and not much else. There was no reason a
   Foreign unit would care where the Domestic player put their lumber
   camp, and vice versa. The fourth role had its own play area, and
   the table was effectively two boards.

2. **The pressure curve was hard to tune.** Without a fail mode, a
   battle deck has to make you feel pressured *without* killing you.
   We were either making the deck too soft (no tension) or too hard (a
   bad turn felt unrecoverable, which the no-fail-mode stance wasn't
   supposed to allow). The shape of the deck — independent draws of
   independent cards — gave very little room to author a curve.

The Global Event Track addresses both.

## The track

Instead of a battle deck, there's a **timed track** of phases that
flips one card per round at the chief→others phase boundary. Each card
is one of three things: a **boon** (a one-time helping hand), a
**modifier** (a passive effect that stays on for a while), or a
**threat** (a creature that walks a path toward the village).

The path is the second piece. Threats don't fight Defense-the-role on
a separate board — they walk a path *across the Domestic grid*. Each
tile the threat passes through, every defense unit on that tile gets a
chance to attack. If the threat survives to the village, something
bad happens — a building burns, a resource is lost from the vault, the
bank takes a hit. The "vault burn" beat (a threat reaching the
center) is its own surfaced animation, because at the table it would
be the moment everyone leans in.

This means **defense units are placed on Domestic tiles**. Same
physical board. The fourth role doesn't have its own play area — it
has units that sit on the buildings the Domestic player built. And
because defense units fire along threat paths, *where* the Domestic
player put their lumber camp suddenly matters: it's also where the
threats walk and where a defender can stand.

The two roles share a board. That's the piece that wasn't there
before.

## The boss

The terminal card of the track is the **boss**. The win condition is
to survive its attack — the entire game pivots toward that one
encounter. The boss's final attack is reduced by **two thresholds**
derived from the game the team played up to that point:

- **Science threshold** — total Library cards bought across every
  seat's discount tableau.
- **Economy threshold** — the *peak* bank gold reached during the
  run, not the current bank. We track a `G.economyHigh` running max,
  refreshed on every bank mutation.

The peak-instead-of-current detail matters more than it sounds.
Without it, the chief is punished for spending — exactly the wrong
incentive in a game whose chief role exists to redistribute. With it,
the chief can spend freely all run and the team's economic
high-water mark is what counts. At the table this is one face-up
chip that ratchets and never falls.

There is no third "military" threshold for a defense-flavored boss,
even though intuitively you'd expect one. An earlier draft included
one; it didn't survive into the live design. Two thresholds means the
boss reads against the *shape of the run* rather than each role's
homework being checked off independently. Defense's contribution
shows up by *spending* its resources fighting threats during the
track, not by stockpiling toward a final number.

## The Science Library

Science got a parallel rework at the same time. The old design was a
3×4 grid of tech cards that science excavated by spending blue over
multiple rounds — at most one completion per round. Two problems
again: it was slow, and once a tech was complete it sat in science's
hand whether the other roles needed it or not.

The new design is a **6-slot face-up Library row** fed from a
tier-stacked deck (T1 → T2 → T3, like Splendor). Per-card cost is
**color × tier**. The science seat has a **discount tableau** —
bought cards leave a discount marker for their color, with Splendor's
floor-1 rule (you always pay at least 1 of the card's color).

The novel piece is **routing by color**:

- A **gold** card goes to the chief's hand.
- A **blue** card goes to science's hand.
- A **green** card goes to domestic's hand.
- A **red** card goes to defense's hand.

So the science player buys cards *for the team*. They aren't picking
what science wants — they're picking what the team needs. The
discount snowball belongs to science (their tableau, their floor-1
cost) but the *cards themselves* end up in someone else's stack.
Science is the team's procurement role.

The discount tableau also feeds the boss. Reaching 5 / 10 / 15 cards
of a single color in any tableau adds a flat strength reduction to
every boss attack — summed across the four colors. So buying a card
does three things at once:

- Hands the card to the recipient role.
- Snowballs the discount on the next card of that color.
- Inches the per-color and overall science thresholds toward the
  boss-fight.

## The lost-ideas pile

Science has a second move: **burn**. Instead of buying a card from the
row, the science seat can burn it — push it to a permanent,
public **lost-ideas pile** on the central board. Burning is free in
resources and expensive in opportunity cost: the row will refill, but
that specific card is gone forever. No discount, no recipient hand,
no threshold credit.

The lost-ideas pile is the only piece of the redesign that exists for
narrative reasons rather than mechanical ones. It's visible, it
groups by color, it shows you the tier of every card the village
chose not to pursue. At the end of a run, the pile is a record of the
shape of the path the team took — not by what it kept, but by what it
deliberately let go. The boss debuffs read off the cards you *bought*;
the pile reads off the cards you *passed on*.

## Why this is more novel than what it replaced

The previous post argued the novelty was *one shape at any seat
count*. That's still the bet. What these two redesigns do is make the
four roles *need each other on a shared board*, in a way the original
Foreign-with-battle-deck didn't:

- Defense places units on Domestic tiles.
- Threats walk paths through the Domestic grid.
- Science buys cards that route to the other three roles' hands.
- Boss thresholds read against what every role did during the run —
  Library cards (everyone), peak bank (chief).

The "tabletop-playable" rule kept the redesigns honest. A track that
walks threats across a grid is a row of cards plus a path drawn on
the village mat. A discount tableau is a stack of cards face-up next
to the science player. A lost-ideas pile is a literal pile of
cardstock. Boss thresholds are counts of physical cards or a peak
chip that ratchets. Nothing here needs the engine to peek at private
state on a player's behalf — every threshold is countable from
what's face-up on the table.

The bet hasn't changed. The mechanism is just more interlocked than
it was.
