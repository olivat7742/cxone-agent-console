// CallControls.tsx
//
// Controls for an ACTIVE contact: mute, hold/resume, end.

import { Button, Stack } from '@mui/material';
import type { Contact } from '../sdk/types';
import { endContact, hold, toggleMute, unhold } from '../sdk/agentClient';

export function CallControls({ contact }: { contact: Contact }) {
  const onHold = contact.status === 'hold';
  const isVoice = contact.channel === 'voice';

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
      {isVoice && (
        <Button
          variant={contact.muted ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => toggleMute(contact.id)}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {contact.muted ? 'Unmute' : 'Mute'}
        </Button>
      )}
      {isVoice && (
        <Button
          variant={onHold ? 'contained' : 'outlined'}
          onClick={() => (onHold ? unhold(contact.id) : hold(contact.id))}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {onHold ? 'Resume' : 'Hold'}
        </Button>
      )}
      <Button
        variant="outlined"
        disabled
        sx={{ width: { xs: '100%', sm: 'auto' }, opacity: 0.7 }}
      >
        Transfer
      </Button>
      <Button
        variant="contained"
        color="error"
        onClick={() => endContact(contact.id)}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        End
      </Button>
    </Stack>
  );
}
