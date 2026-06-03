require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

function requiredEnv(name, options = {}) {
  const value = process.env[name];
  if (isProduction && (!value || options.disallow?.includes(value))) {
    throw new Error(`Missing or unsafe required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,
  jwt: {
    secret: requiredEnv('JWT_SECRET', { disallow: ['default_secret'] }) || 'default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: requiredEnv('JWT_REFRESH_SECRET', { disallow: ['default_refresh_secret'] }) || 'default_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  db: {
    host: requiredEnv('DB_HOST') || 'localhost',
    port: requiredEnv('DB_PORT') || 3306,
    name: requiredEnv('DB_NAME') || 'kuwanyubeiqi',
    user: requiredEnv('DB_USER') || 'root',
    password: requiredEnv('DB_PASSWORD') || '',
  },
};
