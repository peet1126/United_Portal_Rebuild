import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'united_portal',
  logging: console.log,
});

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL successfully');
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync();
      console.log('Tables synced');
    }
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await sequelize.close();
  }
}

test();