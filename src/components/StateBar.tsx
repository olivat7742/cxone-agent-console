// StateBar.tsx
//
// Shows the agent's name and current state, with controls to change state.

import { Box, Button, Chip, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useAgentStore } from '../store/agentStore';
import { setState } from '../sdk/agentClient';
import { logout } from '../auth/login';
import { UNAVAILABLE_REASONS } from '../sdk/types';
import { useState } from 'react';

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
  const [reason, setReason] = useState<string>(UNAVAILABLE_REASONS[0]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h6">{agentName || 'Agent'}</Typography>
        <Chip label={state} color={stateColor[state] ?? 'default'} />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button
          variant="contained"
          color="success"
          onClick={() => setState('Available')}
          disabled={state === 'OnContact'}
        >
          Available
        </Button>
        <Select
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ minWidth: 130 }}
        >
          {UNAVAILABLE_REASONS.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
        <Button
          variant="outlined"
          color="warning"
          onClick={() => setState('Unavailable', reason)}
          disabled={state === 'OnContact'}
        >
          Unavailable
        </Button>
        <Button variant="text" color="inherit" onClick={() => logout()}>
          Log out
        </Button>
      </Stack>
    </Box>
  );
}
