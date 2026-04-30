import { describe, expect, it } from 'vitest';
import { assignRoles, rolesAtSeat, seatOfRole } from '../src/game/roles.ts';

describe('role assignment', () => {
  it('assignRoles(2) matches the literal table from game-design.md §Players', () => {
    expect(assignRoles(2)).toEqual({
      '0': ['chief', 'science'],
      '1': ['domestic', 'foreign'],
    });
  });

  it('seatOfRole(assignRoles(3), "foreign") returns "2"', () => {
    expect(seatOfRole(assignRoles(3), 'foreign')).toBe('2');
  });

  it('rolesAtSeat(assignRoles(1), "0") returns all four roles', () => {
    expect(rolesAtSeat(assignRoles(1), '0')).toEqual([
      'chief',
      'science',
      'domestic',
      'foreign',
    ]);
  });

  it('assignRoles(5 as any) throws', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => assignRoles(5 as any)).toThrow();
  });
});
