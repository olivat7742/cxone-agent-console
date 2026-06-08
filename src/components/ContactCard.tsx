// ContactCard.tsx
//
// Appears when a contact is OFFERED. Lets the agent accept or reject it.

import { Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';
import type { Contact } from '../sdk/types';
import { acceptContact, rejectContact } from '../sdk/agentClient';

const channelLabel: Record<Contact['channel'], string> = {
  voice: 'Voice call',
  chat: 'Chat',
  email: 'Email',
  work_item: 'Work item',
};

export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
      <CardContent>
        <Typography variant="overline" color="primary">
          Incoming {channelLabel[contact.channel]}
        </Typography>
        <Typography variant="h6">{contact.customerName}</Typography>
        {contact.customerDetail && (
          <Typography variant="body2" color="text.secondary">
            {contact.customerDetail}
          </Typography>
        )}
        {contact.skill && (
          <Typography variant="caption" color="text.secondary">
            Skill: {contact.skill}
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="success" onClick={() => acceptContact(contact.id)}>
            Accept
          </Button>
          <Button variant="outlined" color="error" onClick={() => rejectContact(contact.id)}>
            Reject
          </Button>
        </Stack>
      </CardActions>
    </Card>
  );
}
