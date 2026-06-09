// StateBar.tsx
//
// Shows the agent's name and current state, with controls to change state.

import { Box, Button, Chip, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useAgentStore } from '../store/agentStore';
import { setState } from '../sdk/agentClient';
import { logout } from '../auth/login';
import { useEffect, useState } from 'react';

const stateColor: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  Available: 'success',
  Unavailable: 'warning',
  Working: 'info',
  OnContact: 'info',
  LoggedOut: 'default',
};

export function StateBar() {
  const agentName = useAgentStore((s) => s.agentName);
  const state = useAgentStore((s) => s.state);
  const unavailableCodes = useAgentStore((s) => s.unavailableCodes);
  const [reason, setReason] = useState<string>('');

  // Default the selected reason to the first team code once codes load.
  useEffect(() => {
    if (!reason && unavailableCodes.length) setReason(unavailableCodes[0]);
  }, [unavailableCodes, reason]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        p: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Stack>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {agentName || 'Agent'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Current status
          </Typography>
        </Stack>
        <Chip label={state} color={stateColor[state] ?? 'default'} />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', md: 'auto' } }}
      >
        <Button
          variant="contained"
          color="success"
          onClick={() => setState('Available')}
          disabled={state === 'OnContact'}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Available
        </Button>
        <Select
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          displayEmpty
          sx={{ minWidth: 160, width: { xs: '100%', sm: 'auto' } }}
        >
          {unavailableCodes.length === 0 && (
            <MenuItem value="" disabled>
              Loading codes...
            </MenuItem>
          )}
          {unavailableCodes.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
        <Button
          variant="outlined"
          color="warning"
          onClick={() => setState('Unavailable', reason)}
          disabled={state === 'OnContact' || !reason}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Unavailable
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={() => logout()}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Log out
        </Button>
      </Stack>
    </Box>
  );
}
