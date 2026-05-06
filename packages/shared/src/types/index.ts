// Ticket status mirrors what's defined in the GraphQL schema enum.
// Keeping it here means frontend and Lambda share the same type — no drift.
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketCategory {
  FACILITIES = 'FACILITIES',
  CLEANING = 'CLEANING',
  STORE_DESIGN = 'STORE_DESIGN',
  OTHER = 'OTHER',
}

// The shape of a ticket as it flows through the system.
// Lambda returns this from the DB; frontend receives it from AppSync.
export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  submittedBy: string;   // Cognito sub (user ID)
  assignedTo?: string;   // Cognito sub of assigned vendor/admin
  createdAt: string;     // ISO 8601
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  assignedTo?: string;
}
