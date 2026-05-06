import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TicketStatus, type Ticket } from '@united-portal/shared';
import { updateTicket } from '../api/tickets';
import { TicketStatusChip } from './TicketStatusChip';

interface Props {
  ticket: Ticket | null;
  onClose: () => void;
  onUpdated: (ticket: Ticket) => void;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]:        'Open',
  [TicketStatus.IN_PROGRESS]: 'In Progress',
  [TicketStatus.RESOLVED]:    'Resolved',
  [TicketStatus.CLOSED]:      'Closed',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

export function TicketDetailDrawer({ ticket, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? TicketStatus.OPEN);
  const [assignedTo, setAssignedTo] = useState(ticket?.assignedTo ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync local state when a new ticket is opened.
  const open = ticket !== null;
  const handleEntered = () => {
    if (ticket) {
      setStatus(ticket.status);
      setAssignedTo(ticket.assignedTo ?? '');
      setError('');
    }
  };

  const handleSave = async () => {
    if (!ticket) return;
    setError('');
    setLoading(true);
    try {
      const updated = await updateTicket(ticket.id, {
        status,
        assignedTo: assignedTo || undefined,
      });
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      SlideProps={{ onEntered: handleEntered }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, p: 3 } }}
    >
      {ticket && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="h6" fontWeight={600} sx={{ pr: 2 }}>
              {ticket.title}
            </Typography>
            <TicketStatusChip status={ticket.status} />
          </Box>

          <Divider />

          <Row label="Description" value={ticket.description} />
          <Row label="Category" value={ticket.category} />
          <Row label="Submitted by" value={ticket.submittedBy} />
          <Row label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
          <Row label="Updated" value={new Date(ticket.updatedAt).toLocaleString()} />

          <Divider />

          <Typography variant="subtitle2" fontWeight={600}>Update ticket</Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            select
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value as TicketStatus)}
            fullWidth
          >
            {Object.values(TicketStatus).map(s => (
              <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Assigned to (Cognito sub or email)"
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            fullWidth
          />

          <Button variant="contained" onClick={handleSave} disabled={loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}
