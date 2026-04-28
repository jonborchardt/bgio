// Barrel for the Settlement game module.
// Re-export pure types and helpers; bgio-touching modules are added in later stages.

export type {
  CenterMat,
  PlayerID,
  ResourceBag,
  Role,
  SettlementState,
} from './types.ts';

export { assignRoles, rolesAtSeat, seatOfRole } from './roles.ts';
