import { getDb } from './connection';
import { initTicketModel } from '../models/ticket';

// Guard so model init and optional sync only run once per Lambda container.
// On warm invocations, getDb() returns the cached instance and this is a no-op.
let initialized = false;

export async function initDb(): Promise<void> {
  if (initialized) return;

  const db = await getDb();
  initTicketModel(db);

  // DB_SYNC=true creates tables that don't exist yet (idempotent, safe for dev).
  // Never set this in production — use proper migrations instead.
  if (process.env.DB_SYNC === 'true') {
    await db.sync();
  }

  initialized = true;
}
