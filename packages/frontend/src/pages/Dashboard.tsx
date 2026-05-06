import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { TicketStatus, type Ticket } from '@united-portal/shared';
import { listTickets } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import { TicketStatusChip } from '../components/TicketStatusChip';
import { CreateTicketDialog } from '../components/CreateTicketDialog';
import { TicketDetailDrawer } from '../components/TicketDetailDrawer';

type FilterTab = 'ALL' | TicketStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'ALL',                       label: 'All' },
  { value: TicketStatus.OPEN,           label: 'Open' },
  { value: TicketStatus.IN_PROGRESS,    label: 'In Progress' },
  { value: TicketStatus.RESOLVED,       label: 'Resolved' },
  { value: TicketStatus.CLOSED,         label: 'Closed' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { profile, refresh: refreshAuth } = useAuth();

  const [tab, setTab] = useState<FilterTab>('ALL');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const status = tab === 'ALL' ? undefined : tab;
      setTickets(await listTickets(status));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    await refreshAuth();
    navigate('/signin');
  };

  const handleTicketCreated = (ticket: Ticket) => {
    setTickets(prev => [ticket, ...prev]);
  };

  const handleTicketUpdated = (updated: Ticket) => {
    setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  };

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            United Portal
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.85 }}>
            {profile?.name}
          </Typography>
          <Button color="inherit" onClick={handleSignOut} disabled={signingOut} size="small">
            {signingOut ? <CircularProgress size={16} color="inherit" /> : 'Sign out'}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600} sx={{ flexGrow: 1 }}>
            Tickets
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchTickets} disabled={loading} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            New ticket
          </Button>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map(t => <Tab key={t.value} value={t.value} label={t.label} />)}
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : tickets.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
            No tickets found.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted by</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map(ticket => (
                  <TableRow
                    key={ticket.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell>{ticket.title}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {ticket.category.toLowerCase().replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      <TicketStatusChip status={ticket.status} />
                    </TableCell>
                    <TableCell
                      sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {ticket.submittedBy}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      <CreateTicketDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleTicketCreated}
      />
      <TicketDetailDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={handleTicketUpdated}
      />
    </>
  );
}
