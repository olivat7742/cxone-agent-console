// CustomerPanel.tsx
//
// Shows customer / screen-pop data for the active contact. In a real console
// this is where you'd render data fetched from a CRM (Salesforce, Dynamics)
// using the contact's identifiers.

import { Box, Divider, Stack, Typography } from '@mui/material';
import type { Contact } from '../sdk/types';

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value ?? '-'}</Typography>
    </Stack>
  );
}

export function CustomerPanel({ contact }: { contact: Contact }) {
  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
        Customer details
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={1.25}>
        <Row label="Name" value={contact.customerName} />
        <Row label="Contact" value={contact.customerDetail} />
        <Row label="Channel" value={contact.channel} />
        <Row label="Skill" value={contact.skill} />
        <Row label="Status" value={contact.status} />
      </Stack>
    </Box>
  );
}
