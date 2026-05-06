import type { AppSyncResolverEvent } from 'aws-lambda';
import { Ticket, TicketStatus } from '@united-portal/shared';
import { TicketModel, toTicket } from '../models/ticket';

interface Args {
  status?: TicketStatus;
}

export async function listTickets(event: AppSyncResolverEvent<Args>): Promise<Ticket[]> {
  const where = event.arguments.status ? { status: event.arguments.status } : {};
  const tickets = await TicketModel.findAll({
    where,
    order: [['created_at', 'DESC']],
  });
  return tickets.map(toTicket);
}
