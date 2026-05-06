// Science Library SL 5.2 — DiscountTableau.
//
// Read-only per-seat panel summarising the science seat's accumulated
// buy-discounts. Every bought card contributes a -1 discount on a
// single named resource (`discountResource(card)`); this view groups
// those contributions by resource and shows the running total per
// resource as `-N`, alongside the count of cards backing each total.
//
// Sort order matches the canonical `RESOURCES` iteration so the rows
// line up with cost rows and the stash bar elsewhere on the panel.
// No callbacks — the buy / burn affordances live on `LibraryRow`
// (sub-plan 5.1).

import { Paper, Stack, Typography } from '@mui/material';
import type { LibraryCard } from '../../game/library/types.ts';
import { discountResource } from '../../game/library/costs.ts';
import {
  RESOURCES,
  type Resource,
} from '../../game/resources/types.ts';
import type { PlayerID } from '../../game/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';

export interface DiscountTableauProps {
  tableau: LibraryCard[];
  seat: PlayerID;
}

interface DiscountRow {
  resource: Resource;
  total: number;
  count: number;
}

const groupByResource = (tableau: LibraryCard[]): DiscountRow[] => {
  const counts: Partial<Record<Resource, number>> = {};
  for (const card of tableau) {
    const r = discountResource(card);
    counts[r] = (counts[r] ?? 0) + 1;
  }
  // Iterate `RESOURCES` (not `Object.keys`) so row order is the
  // canonical resource order regardless of buy sequence.
  const rows: DiscountRow[] = [];
  for (const r of RESOURCES) {
    const n = counts[r] ?? 0;
    if (n > 0) rows.push({ resource: r, total: n, count: n });
  }
  return rows;
};

export function DiscountTableau({ tableau, seat }: DiscountTableauProps) {
  const rows = groupByResource(tableau);
  return (
    <Paper
      data-component="discount-tableau"
      data-seat={seat}
      elevation={0}
      sx={(t) => ({
        p: 1,
        bgcolor: t.palette.card.surface,
        color: t.palette.card.text,
        boxShadow: t.palette.shadow.card,
      })}
    >
      <Typography
        variant="caption"
        sx={(t) => ({
          color: t.palette.status.muted,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          display: 'block',
          mb: 0.75,
        })}
      >
        Discounts
      </Typography>
      {rows.length === 0 ? (
        <Typography
          variant="body2"
          data-empty="true"
          sx={(t) => ({ color: t.palette.status.muted })}
        >
          No bought cards yet — hit the Library row above.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {rows.map((row) => (
            <Stack
              key={row.resource}
              direction="row"
              spacing={1}
              data-discount-row={row.resource}
              sx={{ alignItems: 'center' }}
            >
              <ResourceToken resource={row.resource} size="detailed" />
              <Typography
                variant="body2"
                data-discount-total={row.total}
                sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                -{row.total}
              </Typography>
              <Typography
                variant="caption"
                data-discount-count={row.count}
                sx={(t) => ({ color: t.palette.status.muted })}
              >
                ({row.count} {row.count === 1 ? 'card' : 'cards'})
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default DiscountTableau;
