// 09.3 — ResourceBag / ResourceChip smoke + RTL render checks.
// Issue 029 closed the it.todos here once @testing-library/react landed.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { ResourceBag } from '../../../src/ui/resources/ResourceBag.tsx';
import { RESOURCES } from '../../../src/game/resources/types.ts';
import type { ResourceBag as ResourceBagType } from '../../../src/game/resources/types.ts';

const emptyBag = (): ResourceBagType => {
  const out = {} as ResourceBagType;
  for (const r of RESOURCES) out[r] = 0;
  return out;
};

const renderBag = (props: Parameters<typeof ResourceBag>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <ResourceBag {...props} />
    </ThemeProvider>,
  );

describe('ResourceBag smoke (09.3)', () => {
  it('ResourceChip imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/resources/ResourceChip.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ResourceChip).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('ResourceBag imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/resources/ResourceBag.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ResourceBag).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('shows only non-zero resources by default (hideZero unset)', () => {
    const bag = emptyBag();
    bag.gold = 3;
    bag.wood = 2;
    renderBag({ bag });
    // ResourceToken renders one tile per resource. The wrapper is
    // labeled "Resource bag"; we count the children directly.
    const wrapper = screen.getByLabelText('Resource bag');
    expect(wrapper.children.length).toBe(2);
  });

  it('hideZero={false} renders every resource slot', () => {
    const bag = emptyBag();
    bag.gold = 1;
    renderBag({ bag, hideZero: false });
    const wrapper = screen.getByLabelText('Resource bag');
    expect(wrapper.children.length).toBe(RESOURCES.length);
  });
});
