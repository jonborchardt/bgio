// React Flow `nodeTypes` registry. Lives in its own file so the
// matching `.tsx` only exports the node component (Vite fast-refresh
// constraint).

import { CardNode } from './CardNode.tsx';

export const cardNodeTypes = { card: CardNode } as const;
