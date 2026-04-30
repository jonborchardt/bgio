// PhaseHint (14.6) — one-line "what you can do now" hint under the
// StatusBar. Pure rule logic lives in `./phaseHintRules.ts` so this
// module can stay React-Refresh-friendly (component-only export).

import { Typography } from '@mui/material';
import { resolveHint, type PhaseHintInput } from './phaseHintRules.ts';

export type PhaseHintProps = PhaseHintInput;

export function PhaseHint(props: PhaseHintProps) {
  const text = resolveHint(props);
  if (text === '') return null;
  return (
    <Typography
      aria-label="Phase hint"
      variant="body2"
      sx={{
        color: (t) => t.palette.status.muted,
        textAlign: 'center',
        fontStyle: 'italic',
      }}
    >
      {text}
    </Typography>
  );
}

export default PhaseHint;
