import type { AppSyncResolverEvent } from 'aws-lambda';
import { Ticket, UpdateTicketInput } from '@united-portal/shared';
import { TicketModel, toTicket } from '../models/ticket';

interface Args {
  id: string;
  input: UpdateTicketInput;
}

export async function updateTicket(event: AppSyncResolverEvent<Args>): Promise<Ticket> {
  const { id, input } = event.arguments;

  const ticket = await TicketModel.findByPk(id);
  if (!ticket) throw new Error(`Ticket not found: ${id}`);

  await ticket.update(input);
  return toTicket(ticket);
}
