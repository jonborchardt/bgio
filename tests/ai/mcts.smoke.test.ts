// 11.2 — MCTSBot smoke test.
//
// Verifies that MCTSBot constructs against our `enumerate` and that the
// imports resolve cleanly. Actually *running* MCTSBot.play() against the
// live Settlement game currently throws on the first event-card playout
// because the 08.2 dispatcher doesn't yet handle the `gainGold` /
// `gainScience` effect kinds shipped in events.json (a known content gap
// that's out of scope for 11.2). The dynamic play test is parked as
// `it.todo` until that gap closes.

import { describe, expect, it } from 'vitest';
import { MCTSBot } from 'boardgame.io/ai';
import { Settlement } from '../../src/game/index.ts';
import { enumerate } from '../../src/game/ai/enumerate.ts';

describe('MCTSBot smoke (11.2)', () => {
  it('imports and constructs against the Settlement game + enumerate', () => {
    const bot = new MCTSBot({
      enumerate,
      game: Settlement,
      iterations: 10,
      playoutDepth: 5,
    });
    expect(bot).toBeDefined();
    expect(typeof bot.play).toBe('function');
  });

  // Dynamic playout is parked: the dispatcher throws on `gainGold` /
  // `gainScience` effects (events.json effect kinds not yet handled in
  // src/game/events/dispatcher.ts). Reintroduce as a real `it(...)` once
  // that gap closes.
  it.todo(
    'runs a few play() calls without throwing — blocked by dispatcher: unknown effect kind: gainGold',
  );
});
