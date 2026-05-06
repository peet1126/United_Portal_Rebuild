import { useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { TicketCategory, type Ticket } from '@united-portal/shared';
import { createTicket } from '../api/tickets';

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.FACILITIES]:   'Facilities',
  [TicketCategory.CLEANING]:     'Cleaning',
  [TicketCategory.STORE_DESIGN]: 'Store Design',
  [TicketCategory.OTHER]:        'Other',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

export function CreateTicketDialog({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.FACILITIES);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setTitle('');
    setDescription('');
    setCategory(TicketCategory.FACILITIES);
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ticket = await createTicket({ title, description, category });
      onCreated(ticket);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New ticket</DialogTitle>
      <DialogContent>
        <form id="create-ticket-form" onSubmit={handleSubmit}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            fullWidth
            autoFocus
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            fullWidth
            multiline
            minRows={3}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value as TicketCategory)}
            fullWidth
          >
            {Object.values(TicketCategory).map(c => (
              <MenuItem key={c} value={c}>{CATEGORY_LABELS[c]}</MenuItem>
            ))}
          </TextField>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="create-ticket-form" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
