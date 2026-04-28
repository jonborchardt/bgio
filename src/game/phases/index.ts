// Barrel for the Settlement phase configs.
//
// 02.1 ships the three-phase skeleton (chief -> others -> endOfRound -> chief);
// later sub-plans (02.2 stages, 02.5 round-end hooks, 04.2 chiefEndPhase) wire
// real behavior into the extension points exposed here.

export { chiefPhase } from './chief.ts';
export { othersPhase } from './others.ts';
export { endOfRound } from './endOfRound.ts';
