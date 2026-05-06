// Load .env when running locally (dotenv is a devDependency; not bundled for Lambda).
// In Lambda, environment variables come from the function configuration.
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();
}

import type { AppSyncResolverEvent } from 'aws-lambda';
import { initDb } from './db/init';
import { getTicket } from './resolvers/getTicket';
import { listTickets } from './resolvers/listTickets';
import { createTicket } from './resolvers/createTicket';
import { updateTicket } from './resolvers/updateTicket';

export const handler = async (event: AppSyncResolverEvent<unknown>) => {
  await initDb();

  const { fieldName } = event.info;

  switch (fieldName) {
    case 'getTicket':
      return getTicket(event as AppSyncResolverEvent<{ id: string }>);
    case 'listTickets':
      return listTickets(event as Parameters<typeof listTickets>[0]);
    case 'createTicket':
      return createTicket(event as Parameters<typeof createTicket>[0]);
    case 'updateTicket':
      return updateTicket(event as Parameters<typeof updateTicket>[0]);
    default:
      throw new Error(`Unknown resolver: ${fieldName}`);
  }
};
