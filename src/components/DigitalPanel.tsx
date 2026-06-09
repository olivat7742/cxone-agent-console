// DigitalPanel.tsx
//
// Handles digital (messaging) contacts: a list of open conversations, the
// selected conversation's message thread, a reply composer, and a wrap-up
// (ACW) form shown after the agent ends the conversation. Reads from the
// digital store; sends via agentClient.

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { DigitalContactView } from '../sdk/types';
import { useDigitalStore } from '../store/digitalStore';
import {
  beginDigitalWrapUp,
  completeDigitalWrapUp,
  saveDigitalOutcome,
  sendDigitalReply,
} from '../sdk/agentClient';

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
              label={`${c.customerName} · ${c.channel}${c.wrapup ? ' · wrap-up' : ''}`}
              color={c.caseId === selected?.caseId ? 'primary' : c.wrapup ? 'warning' : 'default'}
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

            {selected.wrapup ? (
              <DigitalWrapUp contact={selected} />
            ) : (
              /* Reply composer */
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
                  color="warning"
                  onClick={() => beginDigitalWrapUp(selected.caseId)}
                >
                  End & wrap up
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Wrap-up (ACW) form for a digital contact, shown after the agent ends the
 * conversation. Mirrors the voice OutcomePanel: disposition, tags, notes, then
 * Save & complete which saves the outcome and closes the case.
 */
function DigitalWrapUp({ contact }: { contact: DigitalContactView }) {
  const dispositions = contact.dispositions ?? [];

  const [dispositionId, setDispositionId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSaveComplete() {
    setBusy(true);
    setResult(null);
    try {
      await saveDigitalOutcome(
        contact.caseId,
        dispositionId === '' ? null : Number(dispositionId),
        notes,
      );
      await completeDigitalWrapUp(contact.caseId);
      // Contact is removed from the store on completion; no further state needed.
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : String(e) || 'Save failed' });
      setBusy(false);
    }
  }

  return (
    <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'warning.main', bgcolor: 'rgba(245, 166, 35, 0.06)' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'warning.main' }}>
          Wrap-up
        </Typography>

        <FormControl fullWidth size="small">
          <InputLabel id="digital-disposition-label">Disposition</InputLabel>
          <Select
            labelId="digital-disposition-label"
            label="Disposition"
            value={dispositionId}
            onChange={(e) => setDispositionId(e.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {dispositions.map((d) => (
              <MenuItem key={d.id} value={String(d.id)}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Comment"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          size="small"
          fullWidth
          placeholder="Optional notes..."
        />

        {result && (
          <Alert severity={result.ok ? 'success' : 'error'} sx={{ borderRadius: 1 }}>
            <Typography variant="body2">{result.msg}</Typography>
          </Alert>
        )}

        <Button variant="contained" onClick={handleSaveComplete} disabled={busy} fullWidth>
          {busy ? 'Saving...' : 'Save & complete'}
        </Button>
      </Stack>
    </Box>
  );
}
