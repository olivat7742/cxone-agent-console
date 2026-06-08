// LoginPage.tsx
//
// Simple login form. On submit it runs the (mock) auth flow, connects the
// agent client, and flips the global "connected" flag, which causes App to
// render the console.

import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { login } from '../auth/login';
import { connect } from '../sdk/agentClient';
import { useAgentStore } from '../store/agentStore';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setConnected = useAgentStore((s) => s.setConnected);
  const setAgentName = useAgentStore((s) => s.setAgentName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(username, password);
      await connect(result.token);
      setAgentName(result.agentName);
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
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
      <Card sx={{ width: 360 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            CXone Agent Console
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Mock mode. Enter any username to continue.
          </Typography>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              )}
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? 'Connecting...' : 'Log in'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
