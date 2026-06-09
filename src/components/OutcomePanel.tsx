// OutcomePanel.tsx
//
// Wrap-up / outcome panel for a contact: disposition, tags, and a comment.
// Reads the available options from the outcome store (populated by the SDK)
// and saves via agentClient.saveOutcome. For a contact in 'wrapup' (ACW), a
// successful save completes the wrap-up and removes the contact.

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { Contact } from '../sdk/types';
import { completeWrapUp, saveOutcome } from '../sdk/agentClient';
import { useOutcomeStore } from '../store/outcomeStore';

export function OutcomePanel({ contact }: { contact: Contact }) {
  const dispositions = useOutcomeStore((s) => s.dispositions);
  const tags = useOutcomeStore((s) => s.tags);
  const alreadySaved = useOutcomeStore((s) => s.savedContactIds.includes(contact.id));

  const [dispositionId, setDispositionId] = useState<string>('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isWrapUp = contact.status === 'wrapup';
  const needsDisposition = Boolean(contact.requiresDisposition);
  // The platform only accepts a disposition during wrap-up (ACW): saving while
  // the call is active returns 409, and after ACW closes returns 404. So Save
  // is enabled only in the wrap-up window. The agent can pre-select fields
  // during the call; submission happens once the call ends.
  const canSave = !busy && isWrapUp && (!needsDisposition || dispositionId !== '');

  async function handleSave() {
    setBusy(true);
    setResult(null);
    try {
      await saveOutcome(
        contact.id,
        dispositionId === '' ? null : Number(dispositionId),
        notes,
        tagIds,
      );
      setResult({ ok: true, msg: 'Outcome saved.' });
      if (isWrapUp) {
        // Completing wrap-up removes the contact; do it after a brief beat so
        // the agent sees the confirmation.
        completeWrapUp(contact.id);
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  // Already dispositioned (e.g. saved during the call). Don't offer the form
  // again, a second save fails. Just let the agent finish wrap-up.
  if (alreadySaved) {
    return (
      <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {isWrapUp ? 'Wrap-up' : 'Outcome'}
              </Typography>
            </Box>
            <Divider />
            <Alert severity="success" sx={{ borderRadius: 1 }}>
              <Typography variant="body2">
                ✓ Outcome already saved for this contact.
              </Typography>
            </Alert>
            {isWrapUp && (
              <Button
                variant="contained"
                onClick={() => completeWrapUp(contact.id)}
                fullWidth
                size="large"
                sx={{ mt: 1 }}
              >
                Complete wrap-up
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {isWrapUp ? 'Wrap-up' : 'Outcome'}
            </Typography>
            {needsDisposition && (
              <Chip
                label="Required"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <Divider sx={{ my: 0 }} />

          {/* Disposition Field */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Disposition {needsDisposition && <span style={{ color: '#d32f2f' }}>*</span>}
            </Typography>
            <FormControl fullWidth size="small" required={needsDisposition}>
              <InputLabel id="disposition-label">Select a disposition</InputLabel>
              <Select
                labelId="disposition-label"
                label="Select a disposition"
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
          </Box>

          {/* Tags Field */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Tags
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel id="tags-label">Select tags</InputLabel>
              <Select
                labelId="tags-label"
                multiple
                value={tagIds}
                onChange={(e) =>
                  setTagIds(
                    typeof e.target.value === 'string'
                      ? e.target.value.split(',').map(Number)
                      : (e.target.value as number[]),
                  )
                }
                input={<OutlinedInput label="Select tags" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const t = tags.find((x) => x.id === id);
                      return (
                        <Chip
                          key={id}
                          size="small"
                          label={t ? t.name : id}
                          variant="outlined"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {tags.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Comment Field */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Comment
            </Typography>
            <TextField
              label="Add optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={3}
              size="small"
              fullWidth
              placeholder="Enter any additional information or notes..."
            />
          </Box>

          {/* Status Messages */}
          {result && (
            <Alert
              severity={result.ok ? 'success' : 'error'}
              sx={{ borderRadius: 1 }}
            >
              <Typography variant="body2">{result.msg}</Typography>
            </Alert>
          )}

          {/* Information message */}
          {!isWrapUp && (
            <Alert severity="info" sx={{ borderRadius: 1 }}>
              <Typography variant="caption">
                💡 You can prepare the outcome now. The Save button becomes available
                when the call ends (wrap-up).
              </Typography>
            </Alert>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!canSave}
              size="large"
              fullWidth
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
              }}
            >
              {busy ? 'Saving...' : 'Save & complete'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
