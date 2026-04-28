// 12.3 — Replay route stub.
//
// V1 stub: reads `?match=<id>` from the page URL, loads the log from
// localStorage, drives bgio's headless Client through it, and renders
// the resulting `G` as JSON. A real player UI (step controls,
// per-state board rendering) is out of scope for this slice — the
// API surface is what 12.3 ships, and the route is here to verify the
// pipeline end-to-end.
//
// Use case: paste `?match=abc-123` after the URL of a deployed page,
// land on the replay route, see the final state. The
// `tests/replay/replay.test.ts` harness exercises the data layer
// directly without rendering.

import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';
import {
  loadLogFromLocalStorage,
  replay,
  type MoveLog,
} from './MoveLog.ts';

const readMatchIDFromQuery = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('match');
};

export interface ReplayViewProps {
  /** Optional explicit log. When omitted we read `?match=<id>` from the
   *  URL and load from localStorage. */
  log?: MoveLog;
}

export const ReplayView = ({ log }: ReplayViewProps) => {
  const finalState = useMemo(() => {
    const resolved = log ?? (() => {
      const id = readMatchIDFromQuery();
      if (!id) return null;
      return loadLogFromLocalStorage(id);
    })();
    if (!resolved) return null;
    try {
      return replay(resolved);
    } catch (e) {
      return { error: String(e) };
    }
  }, [log]);

  if (!finalState) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>Replay</Typography>
        <Typography variant="body2">
          No log found. Append <code>?match=&lt;id&gt;</code> to the URL.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Replay (V1 stub)
      </Typography>
      <Box
        component="pre"
        sx={{
          fontSize: '0.75rem',
          maxHeight: '70vh',
          overflow: 'auto',
          p: 1.5,
          borderRadius: 1,
          bgcolor: (t) => t.palette.card.surface,
        }}
      >
        {JSON.stringify(finalState, null, 2)}
      </Box>
    </Box>
  );
};

export default ReplayView;
