import { Chip, type ChipProps } from '@mui/material';
import { TicketStatus } from '@united-portal/shared';

const CONFIG: Record<TicketStatus, { label: string; color: ChipProps['color'] }> = {
  [TicketStatus.OPEN]:        { label: 'Open',        color: 'primary' },
  [TicketStatus.IN_PROGRESS]: { label: 'In Progress', color: 'warning' },
  [TicketStatus.RESOLVED]:    { label: 'Resolved',    color: 'success' },
  [TicketStatus.CLOSED]:      { label: 'Closed',      color: 'default' },
};

interface Props {
  status: TicketStatus;
}

export function TicketStatusChip({ status }: Props) {
  const { label, color } = CONFIG[status] ?? { label: status, color: 'default' };
  return <Chip label={label} color={color} size="small" />;
}
