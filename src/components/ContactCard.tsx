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
    <Card
      variant="outlined"
      sx={{
        borderColor: 'primary.main',
        borderWidth: 2,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 18px 32px rgba(15, 23, 42, 0.06)',
      }}
    >
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1.2 }}>
            Incoming {channelLabel[contact.channel]}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {contact.customerName}
          </Typography>
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
        </Stack>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        {contact.requiresAccept ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
            <Button
              variant="contained"
              color="success"
              onClick={() => acceptContact(contact.id)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Accept
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => rejectContact(contact.id)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Reject
            </Button>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Connecting automatically...
          </Typography>
        )}
      </CardActions>
    </Card>
  );
}
