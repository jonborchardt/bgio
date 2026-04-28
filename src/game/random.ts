// Tiny Fisher-Yates shuffle parameterised over a random number function.
//
// This exists so we can keep `setup` pure and unit-testable while still
// producing deterministic shuffles (pass in `ctx.random.Number` from the
// bgio random plugin). 02.3 supersedes this with `ctx.random.Shuffle`
// directly; until then this is the canonical helper.

export const shuffle = <T>(arr: readonly T[], rand: () => number): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};
