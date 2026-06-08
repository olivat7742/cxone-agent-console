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
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {isVoice && (
        <Button
          variant={contact.muted ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => toggleMute(contact.id)}
        >
          {contact.muted ? 'Unmute' : 'Mute'}
        </Button>
      )}
      <Button
        variant={onHold ? 'contained' : 'outlined'}
        onClick={() => (onHold ? unhold(contact.id) : hold(contact.id))}
      >
        {onHold ? 'Resume' : 'Hold'}
      </Button>
      <Button variant="outlined" disabled>
        Transfer
      </Button>
      <Button variant="contained" color="error" onClick={() => endContact(contact.id)}>
        End
      </Button>
    </Stack>
  );
}
