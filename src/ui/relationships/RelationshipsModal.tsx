// Modal shell: opens over the running game (the underlying boardgame.io
// Client keeps ticking — this is a Dialog, not a route change). Drives:
//   - the variation switcher (5 layouts)
//   - a focus-card prop forwarded to whichever variation renders
//   - a "warnings" footer surfaced from `buildCardGraph` so content
//     authors can spot dangling name references during a session.

import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  buildCardGraph,
  type MatchStateForGraph,
} from '../../cards/relationships.ts';
import { VARIATIONS } from './variations/index.ts';

export interface RelationshipsModalProps {
  open: boolean;
  onClose: () => void;
  /** Card id to focus on open. Variations decide what "focus" means. */
  focusId?: string | null;
  /** Optional live match state. When present, science→tech reward
   *  edges reflect the actual per-cell tech assignments instead of
   *  the depth-derivation fallback. */
  matchState?: MatchStateForGraph;
}

export function RelationshipsModal({
  open,
  onClose,
  focusId,
  matchState,
}: RelationshipsModalProps) {
  const [variationId, setVariationId] = useState<string>(VARIATIONS[0].id);
  const graph = useMemo(
    () => buildCardGraph(matchState),
    [matchState],
  );
  const variation =
    VARIATIONS.find((v) => v.id === variationId) ?? VARIATIONS[0];
  const Component = variation.component;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullScreen>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderBottom: '1px solid',
            borderColor: (t) => t.palette.status.muted,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="h6">Card relationships</Typography>
            <Select
              size="small"
              value={variation.id}
              onChange={(e) => setVariationId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {VARIATIONS.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.label}
                </MenuItem>
              ))}
            </Select>
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              {variation.description}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title="Back to the game (Esc)">
              <IconButton
                onClick={onClose}
                aria-label="Back to the game"
                size="small"
                sx={{
                  border: '1px solid',
                  borderColor: (t) => t.palette.status.muted,
                  borderRadius: 1,
                  px: 1,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                ← Back to game
              </IconButton>
            </Tooltip>
            {graph.warnings.length > 0 ? (
              <Tooltip
                title={
                  <Box sx={{ maxWidth: 400 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Unresolved name references:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {graph.warnings.slice(0, 25).map((w, i) => (
                        <li key={i}>
                          <Typography variant="caption">{w.message}</Typography>
                        </li>
                      ))}
                      {graph.warnings.length > 25 ? (
                        <li>
                          <Typography variant="caption">
                            …and {graph.warnings.length - 25} more.
                          </Typography>
                        </li>
                      ) : null}
                    </Box>
                  </Box>
                }
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.role.defense.main,
                    fontWeight: 700,
                  }}
                >
                  {graph.warnings.length} warning
                  {graph.warnings.length === 1 ? '' : 's'}
                </Typography>
              </Tooltip>
            ) : null}
            <IconButton onClick={onClose} aria-label="Close relationships">
              ×
            </IconButton>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Component graph={graph} initialFocusId={focusId ?? null} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default RelationshipsModal;
