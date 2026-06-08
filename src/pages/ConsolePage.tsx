// ConsolePage.tsx
//
// The main agent console. State and contacts now flow from the SDK straight
// into the Zustand stores (see agentClient.ts), so this component just reads
// the stores and renders. The simulator buttons appear only in MOCK_MODE.

import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { MOCK_MODE, simulateIncomingContact } from '../sdk/agentClient';
import { useContactStore } from '../store/contactStore';
import { StateBar } from '../components/StateBar';
import { ContactCard } from '../components/ContactCard';
import { CallControls } from '../components/CallControls';
import { CustomerPanel } from '../components/CustomerPanel';

export function ConsolePage() {
  const contacts = useContactStore((s) => s.contacts);

  const offered = contacts.filter((c) => c.status === 'offered');
  const active = contacts.filter((c) => c.status === 'active' || c.status === 'hold');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <StateBar />

      <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'flex-start' }}>
        {/* Left column: contacts */}
        <Stack spacing={2} sx={{ flex: 2 }}>
          {MOCK_MODE && (
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => simulateIncomingContact('voice')}>
                Simulate voice contact
              </Button>
              <Button variant="outlined" onClick={() => simulateIncomingContact('chat')}>
                Simulate chat
              </Button>
            </Stack>
          )}

          {offered.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}

          {active.map((c) => (
            <Paper key={c.id} sx={{ p: 2 }}>
              <Typography variant="overline" color="primary">
                Active {c.channel}
                {c.status === 'hold' ? ' (on hold)' : ''}
              </Typography>
              <Typography variant="h6">{c.customerName}</Typography>
              <Divider sx={{ my: 1 }} />
              <CallControls contact={c} />
            </Paper>
          ))}

          {contacts.length === 0 && (
            <Typography color="text.secondary">
              No active contacts. Set yourself Available to receive contacts.
            </Typography>
          )}
        </Stack>

        {/* Right column: customer / screen-pop for the first active contact */}
        <Paper sx={{ flex: 1, p: 2, minHeight: 200 }}>
          {active[0] ? (
            <CustomerPanel contact={active[0]} />
          ) : (
            <Typography color="text.secondary">
              Customer details appear here during an active contact.
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
