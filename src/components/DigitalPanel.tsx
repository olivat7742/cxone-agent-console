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
    <Paper sx={{ p: 3, mt: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1.2 }}>
            Digital contacts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {contacts.length} open
          </Typography>
        </Box>

        {/* Conversation selector */}
        <Box sx={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {contacts.map((c) => (
            <Chip
              key={c.caseId}
              label={`${c.customerName} · ${c.channel}`}
              color={c.caseId === selected?.caseId ? 'primary' : 'default'}
              onClick={() => select(c.caseId)}
              variant={c.caseId === selected?.caseId ? 'filled' : 'outlined'}
              sx={{ borderRadius: 2, px: 1.25, py: 0.75 }}
            />
          ))}
        </Box>

        {selected && (
          <Box>
            <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selected.customerName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selected.channel}
                </Typography>
              </Box>
            <Box
              sx={{
                my: 1,
                p: 2,
                minHeight: 240,
                maxHeight: 320,
                overflowY: 'auto',
                bgcolor: 'grey.100',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
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
                    sx={{ display: 'flex', justifyContent: outbound ? 'flex-end' : 'flex-start', mb: 1 }}
                  >
                    <Box
                      sx={{
                        px: 2,
                        py: 1,
                        maxWidth: '75%',
                        borderRadius: 3,
                        bgcolor: outbound ? 'primary.main' : 'background.paper',
                        color: outbound ? 'primary.contrastText' : 'text.primary',
                        boxShadow: outbound
                          ? 'none'
                          : '0 8px 18px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {m.text}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Reply composer */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
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
      </Stack>
    </Paper>
  );
}
