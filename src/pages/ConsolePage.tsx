// ConsolePage.tsx
//
// The main agent console. It does two jobs:
//   1. WIRING: on mount, it subscribes to the agent client's events and pushes
//      updates into the Zustand stores. This is the bridge between the SDK
//      layer and the UI. When you wire in the real SDK, this code does not
//      change, because agentClient already normalizes everything.
//   2. LAYOUT: state bar on top, contacts on the left, customer panel on right.

import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import {
  onContactOffered,
  onContactUpdated,
  onStateChange,
  simulateIncomingContact,
} from '../sdk/agentClient';
import { useAgentStore } from '../store/agentStore';
import { useContactStore } from '../store/contactStore';
import { StateBar } from '../components/StateBar';
import { ContactCard } from '../components/ContactCard';
import { CallControls } from '../components/CallControls';
import { CustomerPanel } from '../components/CustomerPanel';

export function ConsolePage() {
  const setAgentState = useAgentStore((s) => s.setState);
  const contacts = useContactStore((s) => s.contacts);
  const upsertContact = useContactStore((s) => s.upsertContact);
  const removeContact = useContactStore((s) => s.removeContact);

  // Subscribe to SDK events once, on mount. Each on*() returns an unsubscribe
  // function, which we return from useEffect so React cleans up on unmount.
  useEffect(() => {
    const unsubState = onStateChange((state) => setAgentState(state));

    const unsubOffered = onContactOffered((contact) => upsertContact(contact));

    const unsubUpdated = onContactUpdated((contact) => {
      if (contact.status === 'ended') {
        removeContact(contact.id);
      } else {
        upsertContact(contact);
      }
    });

    return () => {
      unsubState();
      unsubOffered();
      unsubUpdated();
    };
  }, [setAgentState, upsertContact, removeContact]);

  const offered = contacts.filter((c) => c.status === 'offered');
  const active = contacts.filter((c) => c.status === 'active' || c.status === 'hold');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <StateBar />

      <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'flex-start' }}>
        {/* Left column: contacts */}
        <Stack spacing={2} sx={{ flex: 2 }}>
          {/* DEMO control. Remove when the real SDK pushes real contacts. */}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => simulateIncomingContact('voice')}>
              Simulate voice contact
            </Button>
            <Button variant="outlined" onClick={() => simulateIncomingContact('chat')}>
              Simulate chat
            </Button>
          </Stack>

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
              No active contacts. Set yourself Available and simulate a contact.
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
