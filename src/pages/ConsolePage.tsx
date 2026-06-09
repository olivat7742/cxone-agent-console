// ConsolePage.tsx
//
// The main agent console. State and contacts flow from the SDK into the Zustand
// stores (see agentClient.ts); this component reads them and renders. The
// simulator buttons appear only in MOCK_MODE.

import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { MOCK_MODE, simulateIncomingContact } from '../sdk/agentClient';
import { useContactStore } from '../store/contactStore';
import { StateBar } from '../components/StateBar';
import { ContactCard } from '../components/ContactCard';
import { CallControls } from '../components/CallControls';
import { CustomerPanel } from '../components/CustomerPanel';
import { OutcomePanel } from '../components/OutcomePanel';
import { DigitalPanel } from '../components/DigitalPanel';

export function ConsolePage() {
  const contacts = useContactStore((s) => s.contacts);

  const offered = contacts.filter((c) => c.status === 'offered');
  const active = contacts.filter((c) => c.status === 'active' || c.status === 'hold');
  const wrapup = contacts.filter((c) => c.status === 'wrapup');
  const focused = active[0] ?? wrapup[0];

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

          {wrapup.map((c) => (
            <Paper key={c.id} sx={{ p: 2, borderLeft: '3px solid', borderColor: 'warning.main' }}>
              <Typography variant="overline" color="warning.main">
                Wrap-up {c.channel}
              </Typography>
              <Typography variant="h6">{c.customerName}</Typography>
              <Typography variant="body2" color="text.secondary">
                Call ended. Complete the outcome on the right to finish.
              </Typography>
            </Paper>
          ))}

          {contacts.length === 0 && (
            <Typography color="text.secondary">
              No active contacts. Set yourself Available to receive contacts.
            </Typography>
          )}
        </Stack>

        {/* Right column: customer info + outcome panel for the focused contact */}
        <Stack spacing={2} sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, minHeight: 160 }}>
            {focused ? (
              <CustomerPanel contact={focused} />
            ) : (
              <Typography color="text.secondary">
                Customer details appear here during a contact.
              </Typography>
            )}
          </Paper>

          {focused && focused.allowDispositions && (
            <Paper sx={{ p: 2 }}>
              <OutcomePanel contact={focused} />
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Digital (messaging) contacts: full-width section below the voice area */}
      <Box sx={{ px: 2, pb: 2 }}>
        <DigitalPanel />
      </Box>
    </Box>
  );
}
