// CallbackPage.tsx
//
// Rendered when NiCE redirects the agent back to our redirectUri after login.
// It reads the ?code= from the URL, exchanges it for a token, starts the
// session, then sends the agent into the console.

import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { completeLogin } from '../auth/login';
import { useAgentStore } from '../store/agentStore';

export function CallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const setConnected = useAgentStore((s) => s.setConnected);
  const setAgentName = useAgentStore((s) => s.setAgentName);
  // Guard against React StrictMode invoking the effect twice in dev.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errParam = params.get('error');

    if (errParam) {
      setError(`Login failed: ${errParam}`);
      return;
    }
    if (!code) {
      setError('No authorization code was found in the callback URL.');
      return;
    }

    completeLogin(code)
      .then(({ agentName }) => {
        setAgentName(agentName);
        setConnected(true);
        // Remove the ?code= from the URL so a refresh does not re-run it.
        // BASE_URL respects the Vite `base` (app root locally and on Pages).
        window.history.replaceState({}, '', import.meta.env.BASE_URL);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Login failed'));
  }, [setConnected, setAgentName]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      {error ? (
        <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 420, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Sign-in problem
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
          <Button variant="contained" onClick={() => window.location.assign(import.meta.env.BASE_URL)}>
            Back to login
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress />
          <Typography>Signing you in...</Typography>
        </Stack>
      )}
    </Box>
  );
}
