// App.tsx
//
// Top-level component. Sets up the MUI theme and does lightweight routing:
//   - /callback (or a URL with ?code=) -> CallbackPage (finish login)
//   - otherwise -> ConsolePage if connected, else LoginPage
// On a normal load it also tries to restore an existing session so a refresh
// does not force the agent to log in again.

import { Box, CircularProgress, createTheme, CssBaseline, Stack, ThemeProvider, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useAgentStore } from './store/agentStore';
import { restoreSession } from './auth/login';
import { LoginPage } from './pages/LoginPage';
import { ConsolePage } from './pages/ConsolePage';
import { CallbackPage } from './pages/CallbackPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0a6cff' },
  },
});

type Route = 'callback' | 'app';

function getRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname.endsWith('/callback') || params.has('code') || params.has('error')) {
    return 'callback';
  }
  return 'app';
}

function LoadingScreen() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading...</Typography>
      </Stack>
    </Box>
  );
}

function App() {
  const connected = useAgentStore((s) => s.connected);
  const setConnected = useAgentStore((s) => s.setConnected);
  const setAgentName = useAgentStore((s) => s.setAgentName);

  const route = getRoute();
  const [restoring, setRestoring] = useState(route === 'app');

  useEffect(() => {
    if (route !== 'app') {
      setRestoring(false);
      return;
    }
    let active = true;
    restoreSession().then((info) => {
      if (!active) return;
      if (info) {
        setAgentName(info.agentName);
        setConnected(true);
      }
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, [route, setConnected, setAgentName]);

  let content;
  if (route === 'callback') {
    content = <CallbackPage />;
  } else if (restoring) {
    content = <LoadingScreen />;
  } else {
    content = connected ? <ConsolePage /> : <LoginPage />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  );
}

export default App;
