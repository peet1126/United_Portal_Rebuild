import type { AppSyncResolverEvent, AppSyncIdentityCognito } from 'aws-lambda';
import { Ticket, CreateTicketInput } from '@united-portal/shared';
import { TicketModel, toTicket } from '../models/ticket';

interface Args {
  input: CreateTicketInput;
}

export async function createTicket(event: AppSyncResolverEvent<Args>): Promise<Ticket> {
  const { input } = event.arguments;

  // In production, AppSync populates identity from the Cognito JWT.
  // During local testing there's no real auth context, so we fall back.
  const identity = event.identity as AppSyncIdentityCognito | null;
  const submittedBy = identity?.sub ?? 'local-test-user';

  const ticket = await TicketModel.create({
    title: input.title,
    description: input.description,
    category: input.category,
    submittedBy,
  });

  return toTicket(ticket);
}
