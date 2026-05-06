import { Sequelize } from 'sequelize';
import { Signer } from '@aws-sdk/rds-signer';

// Module-level cache — survives across warm Lambda invocations.
// A single Sequelize instance = a single connection pool per container.
let sequelize: Sequelize | null = null;

function isLocal(): boolean {
  return !process.env.DB_PROXY_ENDPOINT;
}

export async function getDb(): Promise<Sequelize> {
  if (sequelize) return sequelize;

  if (isLocal()) {
    sequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'united_portal',
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      logging: false,
      pool: { max: 2, min: 0, acquire: 30000, idle: 10000 },
    });
  } else {
    // RDS Proxy with IAM auth.
    // The Signer generates a presigned URL used as the MySQL password.
    // Token is valid for 15 min; we refresh it on each new connection attempt
    // via the beforeConnect hook so long-lived containers stay healthy.
    const signer = new Signer({
      hostname: process.env.DB_PROXY_ENDPOINT!,
      port: 3306,
      username: process.env.DB_IAM_USER ?? 'lambda_user',
      region: process.env.AWS_REGION ?? 'us-east-1',
    });

    sequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_PROXY_ENDPOINT,
      port: 3306,
      database: process.env.DB_NAME ?? 'united_portal',
      username: process.env.DB_IAM_USER ?? 'lambda_user',
      password: '',
      dialectOptions: {
        ssl: { rejectUnauthorized: true },
      },
      logging: false,
      pool: { max: 2, min: 0, acquire: 30000, idle: 10000 },
    });

    // beforeConnect must be registered as a Sequelize hook, not inside
    // dialectOptions — dialectOptions passes through to the mysql2 driver
    // and Sequelize never looks for hooks there.
    // This hook fires before each new connection is opened, refreshing the
    // IAM token so long-lived Lambda containers never send a stale credential.
    sequelize.addHook('beforeConnect', async (config: Record<string, unknown>) => {
      config['password'] = await signer.getAuthToken();
    });
  }

  await sequelize.authenticate();
  return sequelize;
}
