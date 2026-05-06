import { generateClient } from 'aws-amplify/api';
import type { Ticket, CreateTicketInput, UpdateTicketInput, TicketStatus } from '@united-portal/shared';

const client = generateClient();

// Shared field selection — used by every query/mutation so the shape is consistent.
const TICKET_FIELDS = `
  id title description category status
  submittedBy assignedTo createdAt updatedAt
`;

const LIST_TICKETS = `
  query ListTickets($status: TicketStatus) {
    listTickets(status: $status) { ${TICKET_FIELDS} }
  }
`;

const CREATE_TICKET = `
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) { ${TICKET_FIELDS} }
  }
`;

const UPDATE_TICKET = `
  mutation UpdateTicket($id: ID!, $input: UpdateTicketInput!) {
    updateTicket(id: $id, input: $input) { ${TICKET_FIELDS} }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(result: any, key: string): T {
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data[key] as T;
}

export async function listTickets(status?: TicketStatus): Promise<Ticket[]> {
  const result = await client.graphql({ query: LIST_TICKETS, variables: { status } });
  return unwrap<Ticket[]>(result, 'listTickets');
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const result = await client.graphql({ query: CREATE_TICKET, variables: { input } });
  return unwrap<Ticket>(result, 'createTicket');
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
  const result = await client.graphql({ query: UPDATE_TICKET, variables: { id, input } });
  return unwrap<Ticket>(result, 'updateTicket');
}
