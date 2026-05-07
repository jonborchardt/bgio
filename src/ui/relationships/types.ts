// Shared shapes for the relationships UI: filter / cluster / layout
// settings used by every variation. Kept in one file so adding a new
// option (e.g. a new clustering algorithm) only touches one place.

import type { CardKind } from '../../cards/registry.ts';
import type { EdgeKind } from '../../cards/relationships.ts';

export type ClusterAlgorithm =
  | 'none'
  | 'byKind'
  | 'byBranchOrTier'
  | 'byCostBand'
  | 'byComponent';

export const ALL_CLUSTER_ALGORITHMS: ReadonlyArray<ClusterAlgorithm> = [
  'none',
  'byKind',
  'byBranchOrTier',
  'byCostBand',
  'byComponent',
];

export const CLUSTER_LABELS: Record<ClusterAlgorithm, string> = {
  none: 'No clustering',
  byKind: 'By card kind',
  byBranchOrTier: 'By tech branch / tier',
  byCostBand: 'By cost band',
  byComponent: 'By connected component',
};

export type LayoutEngine = 'dagre' | 'force' | 'circular' | 'grid';

export const ALL_LAYOUT_ENGINES: ReadonlyArray<LayoutEngine> = [
  'dagre',
  'force',
  'circular',
  'grid',
];

export const LAYOUT_LABELS: Record<LayoutEngine, string> = {
  dagre: 'Dagre (hierarchical)',
  force: 'Force-directed',
  circular: 'Circular',
  grid: 'Grid',
};

export interface GraphViewSettings {
  cluster: ClusterAlgorithm;
  layout: LayoutEngine;
  /** Intra-cluster node spacing in px. */
  nodeSpacing: number;
  /** Inter-cluster gap in px. */
  clusterSpacing: number;
  /** Edge kinds currently visible. */
  visibleEdgeKinds: ReadonlySet<EdgeKind>;
  /** Card kinds currently visible. */
  visibleCardKinds: ReadonlySet<CardKind>;
  /** Free-text search; matches non-matching nodes are dimmed, not hidden. */
  search: string;
  hideOrphans: boolean;
  showEdgeLabels: boolean;
}

export const defaultGraphSettings = (
  _allEdgeKinds: ReadonlyArray<EdgeKind>,
  allCardKinds: ReadonlyArray<CardKind>,
): GraphViewSettings => ({
  cluster: 'byKind',
  layout: 'dagre',
  nodeSpacing: 60,
  clusterSpacing: 200,
  // Start with the simplest, most readable slice: tech → building only.
  // The full edge list is overwhelming on first open (~hundreds of
  // edges); the user re-enables the rest from the controls panel.
  visibleEdgeKinds: new Set<EdgeKind>(['tech-unlocks-building']),
  visibleCardKinds: new Set(allCardKinds),
  search: '',
  // Tech-only edges leave most non-tech/non-building cards unconnected;
  // hide them by default so the initial view is just the visible web.
  hideOrphans: true,
  showEdgeLabels: false,
});
