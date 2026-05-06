import type { AppSyncResolverEvent } from 'aws-lambda';
import { Ticket } from '@united-portal/shared';
import { TicketModel, toTicket } from '../models/ticket';

interface Args {
  id: string;
}

export async function getTicket(event: AppSyncResolverEvent<Args>): Promise<Ticket> {
  const ticket = await TicketModel.findByPk(event.arguments.id);
  if (!ticket) throw new Error(`Ticket not found: ${event.arguments.id}`);
  return toTicket(ticket);
}
