// Shared controls panel for any variation that exposes a graph.
// Variation 3 (grid-only) hides the cluster/layout/edge-styling sections
// via the `compact` prop and keeps only node filters.

import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ALL_CLUSTER_ALGORITHMS,
  ALL_LAYOUT_ENGINES,
  CLUSTER_LABELS,
  LAYOUT_LABELS,
  type GraphViewSettings,
} from './types.ts';
import {
  ALL_EDGE_KINDS,
  EDGE_KIND_LABELS,
  type EdgeKind,
} from '../../cards/relationships.ts';
import {
  CARD_KINDS,
  CARD_KIND_LABELS,
  type CardKind,
} from '../../cards/registry.ts';

export interface GraphControlsProps {
  value: GraphViewSettings;
  onChange: (next: GraphViewSettings) => void;
  /** Hide cluster / layout / edge-styling sections (variation 3). */
  compact?: boolean;
  /** Hide the "Search cards" field (variations that bring their own
   *  focus picker — e.g. variation 6 — don't need a duplicate input). */
  hideSearch?: boolean;
}

const toggleInSet = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export function GraphControls({
  value,
  onChange,
  compact,
  hideSearch,
}: GraphControlsProps) {
  const set = (patch: Partial<GraphViewSettings>) =>
    onChange({ ...value, ...patch });

  return (
    <Stack spacing={2} sx={{ p: 1.5 }}>
      {hideSearch ? null : (
        <TextField
          size="small"
          label="Search cards"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="dim non-matching nodes"
          fullWidth
        />
      )}

      <Box>
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Card kinds
        </Typography>
        <Stack>
          {CARD_KINDS.map((k: CardKind) => (
            <FormControlLabel
              key={k}
              control={
                <Checkbox
                  size="small"
                  checked={value.visibleCardKinds.has(k)}
                  onChange={() =>
                    set({ visibleCardKinds: toggleInSet(value.visibleCardKinds, k) })
                  }
                />
              }
              label={CARD_KIND_LABELS[k]}
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8rem' } }}
            />
          ))}
        </Stack>
      </Box>

      {compact ? null : (
        <>
          <Divider />
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Edge kinds
            </Typography>
            <Stack>
              {ALL_EDGE_KINDS.map((k: EdgeKind) => (
                <FormControlLabel
                  key={k}
                  control={
                    <Checkbox
                      size="small"
                      checked={value.visibleEdgeKinds.has(k)}
                      onChange={() =>
                        set({ visibleEdgeKinds: toggleInSet(value.visibleEdgeKinds, k) })
                      }
                    />
                  }
                  label={EDGE_KIND_LABELS[k]}
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8rem' } }}
                />
              ))}
            </Stack>
          </Box>

          <Divider />
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Clustering
            </Typography>
            <Select
              size="small"
              value={value.cluster}
              onChange={(e) =>
                set({ cluster: e.target.value as GraphViewSettings['cluster'] })
              }
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {ALL_CLUSTER_ALGORITHMS.map((a) => (
                <MenuItem key={a} value={a}>
                  {CLUSTER_LABELS[a]}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Layout
            </Typography>
            <Select
              size="small"
              value={value.layout}
              onChange={(e) =>
                set({ layout: e.target.value as GraphViewSettings['layout'] })
              }
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {ALL_LAYOUT_ENGINES.map((l) => (
                <MenuItem key={l} value={l}>
                  {LAYOUT_LABELS[l]}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
              Node spacing: {value.nodeSpacing}px
            </Typography>
            <Slider
              size="small"
              value={value.nodeSpacing}
              min={20}
              max={200}
              step={10}
              onChange={(_e, v) => set({ nodeSpacing: v as number })}
            />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
              Cluster spacing: {value.clusterSpacing}px
            </Typography>
            <Slider
              size="small"
              value={value.clusterSpacing}
              min={50}
              max={500}
              step={10}
              onChange={(_e, v) => set({ clusterSpacing: v as number })}
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={value.showEdgeLabels}
                onChange={(e) => set({ showEdgeLabels: e.target.checked })}
              />
            }
            label="Show edge labels"
            sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8rem' } }}
          />
        </>
      )}

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={value.hideOrphans}
            onChange={(e) => set({ hideOrphans: e.target.checked })}
          />
        }
        label="Hide orphans (no visible edges)"
        sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8rem' } }}
      />
    </Stack>
  );
}

export default GraphControls;
