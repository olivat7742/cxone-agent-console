// LoginPage.tsx
//
// Real CXone login. Clicking the button redirects the agent to NiCE's hosted
// login page (OIDC + PKCE). If the .env config is missing, it shows setup
// instructions instead of a dead button.

import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { startLogin } from '../auth/login';
import { getMissingConfigKeys } from '../auth/config';

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = getMissingConfigKeys();
  const configured = missing.length === 0;

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await startLogin(); // redirects away on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start login');
      setBusy(false);
    }
  }

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
      <Card sx={{ width: 420 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            OAT CXone Agent Console
          </Typography>

          {configured ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Sign in with your CXone account to start handling contacts.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              <Button variant="contained" size="large" disabled={busy} onClick={handleLogin}>
                {busy ? 'Redirecting...' : 'Log in with CXone'}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                CXone authentication is not configured yet.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Create a <code>.env</code> file (copy <code>.env.example</code>) and set the
                following from your CXone app registration:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {missing.map((k) => (
                  <li key={k}>
                    <code>{k}</code>
                  </li>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Restart the dev server after editing .env.
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
