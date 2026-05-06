import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
} from 'sequelize';
import { Ticket, TicketStatus, TicketCategory } from '@united-portal/shared';

export class TicketModel extends Model<
  InferAttributes<TicketModel>,
  InferCreationAttributes<TicketModel>
> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare description: string;
  declare category: TicketCategory;
  declare status: CreationOptional<TicketStatus>;
  declare submittedBy: string;
  declare assignedTo: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initTicketModel(db: Sequelize): void {
  TicketModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(...Object.values(TicketCategory)),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(TicketStatus)),
        defaultValue: TicketStatus.OPEN,
        allowNull: false,
      },
      submittedBy: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      assignedTo: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: db,
      tableName: 'tickets',
      // underscored maps camelCase JS fields to snake_case DB columns
      // e.g. submittedBy → submitted_by, createdAt → created_at
      underscored: true,
    },
  );
}

// Converts a TicketModel instance to the plain Ticket interface,
// normalising Date objects to ISO strings to match the shared type.
export function toTicket(model: TicketModel): Ticket {
  return {
    id: model.id,
    title: model.title,
    description: model.description,
    category: model.category,
    status: model.status,
    submittedBy: model.submittedBy,
    assignedTo: model.assignedTo ?? undefined,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}
