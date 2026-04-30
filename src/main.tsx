import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { theme } from './theme.ts';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 4,
          // boardgame.io's Client wrapper renders as `<div class="bgio-client">`
          // with no explicit width, so it collapses to its content's intrinsic
          // width. Without this rule the Board's `width: min(100%, 60rem)`
          // resolves `100%` against that collapsed parent, and each role
          // panel renders at a different width depending on its content's
          // min-content size. Force it to fill the flex slot.
          '& .bgio-client': { width: '100%', minWidth: 0 },
        }}
      >
        <App />
      </Box>
    </ThemeProvider>
  </StrictMode>,
);
