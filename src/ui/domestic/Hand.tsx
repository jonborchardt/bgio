// Domestic Hand — horizontal row of building cards the Domestic seat can buy
// & place. Each entry is a vertical card (name / cost / benefit) so the seat
// can compare options at a glance; the `note` (and the affordability warning)
// surface in the hover tooltip. Selection is panel-owned: clicking a card
// calls `onSelect(name)` and the panel decides "begin placing" vs "deselect".

import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';
import { buildingCost } from '../../data/index.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';

export interface HandProps {
  hand: BuildingDef[];
  selectedName?: string;
  onSelect: (name: string) => void;
  // Filter the visible hand to cards whose gold-equivalent cost is within
  // `AFFORD_SLACK` of the seat's gold (so the menu doesn't drown the seat
  // in unreachable cards). Multi-resource costs use the same `cost`
  // heuristic — it's a relevance filter, not an affordability check. The
  // real affordability check uses the seat's full stash via `canAfford`.
  playerGold: number;
  // Full stash, used for the per-card affordability check on multi-
  // resource costs. Optional for back-compat; when omitted we fall back
  // to gold-only.
  stash?: ResourceBag;
}

const AFFORD_SLACK = 20;

// Stable, deterministic order over the cost entries actually present on the
// bag. Mirrors the canonical RESOURCES ordering so chips appear in the same
// order regardless of JSON key order.
const costEntries = (
  bag: Partial<ResourceBag>,
): Array<{ resource: Resource; amount: number }> => {
  const out: Array<{ resource: Resource; amount: number }> = [];
  for (const r of RESOURCES) {
    const v = bag[r] ?? 0;
    if (v > 0) out.push({ resource: r, amount: v });
  }
  return out;
};

export function Hand({ hand, selectedName, onSelect, playerGold, stash }: HandProps) {
  const visible = hand.filter(
    (card) => card.cost <= playerGold + AFFORD_SLACK || card.name === selectedName,
  );
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role.domestic.main,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
        }}
      >
        Buildings to buy
      </Typography>
      <Stack
        direction="row"
        spacing={1.25}
        aria-label="Domestic hand"
        sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'stretch' }}
      >
        {visible.map((card) => {
        const isSelected = card.name === selectedName;
        const cost = buildingCost(card);
        const entries = costEntries(cost);
        const affordable = stash
          ? canAfford(stash, cost)
          : playerGold >= card.cost;
        const tooltipParts: string[] = [];
        if (card.note) tooltipParts.push(card.note);
        if (!affordable) {
          const costStr = entries.length === 0
            ? 'free'
            : entries.map((e) => `${e.amount} ${e.resource}`).join(', ');
          tooltipParts.push(`Need ${costStr}`);
        }
        const tooltip = tooltipParts.join(' — ');
        return (
          <Tooltip
            key={card.name}
            title={tooltip}
            placement="top"
            disableHoverListener={tooltip === ''}
          >
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <ButtonBase
                disabled={!affordable}
                onClick={() => onSelect(card.name)}
                aria-label={`Select building ${card.name}`}
                aria-pressed={isSelected}
                sx={{
                  width: '9.5rem',
                  minHeight: '6rem',
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: (t) =>
                    affordable
                      ? isSelected
                        ? t.palette.role.domestic.light
                        : t.palette.role.domestic.dark
                      : t.palette.status.muted,
                  bgcolor: (t) =>
                    !affordable
                      ? t.palette.card.takenSurface
                      : isSelected
                        ? t.palette.role.domestic.dark
                        : t.palette.card.surface,
                  color: (t) =>
                    !affordable ? t.palette.card.takenText : t.palette.card.text,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  textAlign: 'left',
                  overflow: 'hidden',
                  boxShadow: affordable
                    ? isSelected
                      ? '0 0 0 2px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.35)'
                      : '0 1px 3px rgba(0,0,0,0.35)'
                    : 'none',
                  filter: affordable ? 'none' : 'grayscale(0.7)',
                  transition:
                    'background-color 120ms, border-color 120ms, box-shadow 120ms, transform 120ms',
                  '&:hover': {
                    bgcolor: (t) =>
                      isSelected
                        ? t.palette.role.domestic.main
                        : t.palette.role.domestic.dark,
                    borderColor: (t) => t.palette.role.domestic.light,
                    color: (t) => t.palette.role.domestic.contrastText,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
                  },
                  '&.Mui-disabled': {
                    pointerEvents: 'auto',
                    cursor: 'default',
                  },
                }}
              >
                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    bgcolor: (t) =>
                      affordable
                        ? isSelected
                          ? t.palette.role.domestic.main
                          : t.palette.role.domestic.dark
                        : 'transparent',
                    color: (t) =>
                      affordable
                        ? t.palette.role.domestic.contrastText
                        : t.palette.card.takenText,
                    borderBottom: '1px solid',
                    borderColor: (t) =>
                      affordable
                        ? t.palette.role.domestic.light
                        : t.palette.status.muted,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.2,
                      letterSpacing: 0.2,
                    }}
                  >
                    {card.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: 'center', flexShrink: 0 }}
                  >
                    {entries.length === 0 ? (
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        free
                      </Typography>
                    ) : (
                      entries.map((e) => (
                        <Stack
                          key={e.resource}
                          direction="row"
                          spacing={0.25}
                          sx={{ alignItems: 'center' }}
                        >
                          <Box
                            aria-hidden
                            sx={{
                              width: '0.5rem',
                              height: '0.5rem',
                              borderRadius: '50%',
                              bgcolor: (t) =>
                                t.palette.resource[e.resource].main,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            {e.amount}
                          </Typography>
                        </Stack>
                      ))
                    )}
                  </Stack>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    px: 1,
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'flex-start',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      lineHeight: 1.3,
                      opacity: affordable ? 0.95 : 0.7,
                      wordBreak: 'break-word',
                    }}
                  >
                    {card.benefit}
                  </Typography>
                </Box>
              </ButtonBase>
            </Box>
          </Tooltip>
        );
        })}
      </Stack>
    </Stack>
  );
}

export default Hand;
