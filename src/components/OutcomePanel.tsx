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

  const [dispositionId, setDispositionId] = useState<string>('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isWrapUp = contact.status === 'wrapup';
  const needsDisposition = Boolean(contact.requiresDisposition);
  const canSave = !busy && (!needsDisposition || dispositionId !== '');

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

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        {isWrapUp ? 'Wrap-up' : 'Outcome'}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />

      <Stack spacing={2}>
        <FormControl fullWidth size="small" required={needsDisposition}>
          <InputLabel id="disposition-label">Disposition</InputLabel>
          <Select
            labelId="disposition-label"
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

        <FormControl fullWidth size="small">
          <InputLabel id="tags-label">Tags</InputLabel>
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
            input={<OutlinedInput label="Tags" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as number[]).map((id) => {
                  const t = tags.find((x) => x.id === id);
                  return <Chip key={id} size="small" label={t ? t.name : id} />;
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

        <TextField
          label="Comment"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          size="small"
          fullWidth
        />

        {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.msg}</Alert>}

        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          {busy ? 'Saving...' : isWrapUp ? 'Save & complete' : 'Save outcome'}
        </Button>
      </Stack>
    </Box>
  );
}
