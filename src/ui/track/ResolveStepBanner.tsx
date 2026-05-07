// ResolveStepBanner — paced playback HUD.
//
// Floats over the central board's village-grid well while a resolve
// animation is mid-playback. Surfaces the current step's narration,
// "step n / total" progress, and a Continue button that calls
// `advance()` on the resolve-animation context. The auto-advance timer
// inside the provider already handles the "do nothing" path; this HUD
// exists so the table can manually pace through phases when they want
// to read each one in detail.
//
// Pure presentation; reads from `ResolveAnimationContext` and renders
// nothing when the provider is idle. All visual choices route through
// theme tokens (CLAUDE.md rule).

import { useContext } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ResolveAnimationContext } from './resolveAnimation.ts';
import type { ResolveStepKind } from './resolveSteps.ts';

const KIND_LABEL: Record<ResolveStepKind, string> = {
  enter: 'Threat',
  fire: 'Defender fires',
  impact: 'Impact',
  centerBurn: 'Vault burn',
};

export function ResolveStepBanner() {
  const { currentStep, currentStepIndex, totalSteps, advance } = useContext(
    ResolveAnimationContext,
  );
  if (currentStep === null) return null;

  const isLast = currentStepIndex >= totalSteps - 1;
  const buttonLabel = isLast ? 'Finish ▸' : 'Continue ▸';

  return (
    <Box
      data-testid="resolve-step-banner"
      data-step-kind={currentStep.kind}
      data-step-index={currentStepIndex}
      data-step-total={totalSteps}
      role="status"
      aria-live="polite"
      sx={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        // Keep the banner narrow so it doesn't obscure the village; long
        // descriptions wrap.
        maxWidth: 'min(360px, calc(100% - 24px))',
        px: 1.25,
        py: 0.75,
        borderRadius: 1,
        bgcolor: (t) => t.palette.appSurface.base,
        border: '2px solid',
        borderColor: (t) => t.palette.role.defense.main,
        boxShadow: (t) => t.palette.shadow.floating,
        // The banner shouldn't capture clicks outside the button itself
        // — the village grid below stays interactive (e.g. for
        // tooltips). We re-enable pointer events on the button.
        pointerEvents: 'none',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: (t) => t.palette.role.defense.light,
              display: 'block',
              lineHeight: 1.1,
            }}
          >
            {KIND_LABEL[currentStep.kind]} · {currentStepIndex + 1}/{totalSteps}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: (t) => t.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            {currentStep.description}
          </Typography>
        </Box>
        <Box sx={{ pointerEvents: 'auto' }}>
          <Button
            size="small"
            variant="contained"
            onClick={advance}
            data-testid="resolve-step-continue"
            aria-label={buttonLabel}
            sx={{
              bgcolor: (t) => t.palette.role.defense.main,
              color: (t) => t.palette.role.defense.contrastText,
              fontWeight: 700,
              minWidth: 0,
              '&:hover': {
                bgcolor: (t) => t.palette.role.defense.dark,
              },
            }}
          >
            {buttonLabel}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export default ResolveStepBanner;
