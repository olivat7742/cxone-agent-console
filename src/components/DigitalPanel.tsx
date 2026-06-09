// DigitalPanel.tsx
//
// Handles digital (messaging) contacts: a list of open conversations, the
// selected conversation's message thread, and a reply composer. Reads from the
// digital store; sends via agentClient.

import { Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useDigitalStore } from '../store/digitalStore';
import { resolveDigitalContact, sendDigitalReply } from '../sdk/agentClient';

export function DigitalPanel() {
  const contacts = useDigitalStore((s) => s.contacts);
  const selectedCaseId = useDigitalStore((s) => s.selectedCaseId);
  const select = useDigitalStore((s) => s.select);

  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  if (contacts.length === 0) return null;

  const selected = contacts.find((c) => c.caseId === selectedCaseId) ?? contacts[0];

  async function handleSend() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await sendDigitalReply(selected.caseId, reply.trim());
      setReply('');
    } catch (e) {
      console.warn('[DigitalPanel] reply failed:', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="overline" color="primary">
        Digital contacts
      </Typography>

      {/* Conversation selector */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', my: 1 }}>
        {contacts.map((c) => (
          <Chip
            key={c.caseId}
            label={`${c.customerName} · ${c.channel}`}
            color={c.caseId === selected?.caseId ? 'primary' : 'default'}
            onClick={() => select(c.caseId)}
            variant={c.caseId === selected?.caseId ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {selected && (
        <Box>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="subtitle2">
            {selected.customerName} ({selected.channel})
          </Typography>

          {/* Message thread */}
          <Box
            sx={{
              my: 1,
              p: 1,
              maxHeight: 280,
              overflowY: 'auto',
              bgcolor: 'background.default',
              borderRadius: 1,
            }}
          >
            {selected.messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No messages yet.
              </Typography>
            )}
            {selected.messages.map((m) => {
              const outbound = m.direction === 'outbound';
              return (
                <Box
                  key={m.id}
                  sx={{ display: 'flex', justifyContent: outbound ? 'flex-end' : 'flex-start', mb: 0.5 }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      maxWidth: '75%',
                      borderRadius: 2,
                      bgcolor: outbound ? 'primary.main' : 'grey.300',
                      color: outbound ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    <Typography variant="body2">{m.text}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Reply composer */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Type a reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button variant="contained" onClick={handleSend} disabled={busy || !reply.trim()}>
              Send
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => resolveDigitalContact(selected.caseId)}
            >
              Resolve
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
