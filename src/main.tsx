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
          // `flex-start` (not `center`) so tall content stays anchored
          // at the top — `align-items: center` clips the top of any
          // content taller than the viewport because flex centering
          // pushes the overflow above scroll position 0.
          alignItems: 'flex-start',
          justifyContent: 'center',
          px: 2,
          py: 4,
        }}
      >
        {/* Issue 057f — earlier this used a `& .bgio-client` selector
            to size bgio's auto-rendered wrapper. That couples to a
            bgio-internal class name; we wrap the App ourselves so
            our Box wins the flex slot regardless of what bgio names
            its child div. Without the explicit width the Board's
            `width: min(100%, 60rem)` would resolve `100%` against a
            collapsed parent. */}
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <App />
        </Box>
      </Box>
    </ThemeProvider>
  </StrictMode>,
);
