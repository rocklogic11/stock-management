const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const env = { ...process.env };

if (envPath) {
  if (!fs.existsSync(envPath)) {
    console.error(`[env-check] file not found: ${envPath}`);
    process.exit(1);
  }
  Object.assign(env, dotenv.parse(fs.readFileSync(envPath)));
}

const checks = [
  { name: 'NODE_ENV', required: true, expected: 'production' },
  { name: 'PORT', required: true },
  { name: 'DB_DIALECT', required: true, expected: 'mysql' },
  { name: 'DB_HOST', required: true },
  { name: 'DB_PORT', required: true },
  { name: 'DB_NAME', required: true },
  { name: 'DB_USER', required: true },
  { name: 'DB_PASSWORD', required: true, minLength: 12 },
  { name: 'JWT_SECRET', required: true, minLength: 32, disallow: ['default_secret', 'replace-with-long-random-secret'] },
  { name: 'JWT_REFRESH_SECRET', required: true, minLength: 32, disallow: ['default_refresh_secret', 'replace-with-long-random-refresh-secret'] },
  { name: 'JWT_EXPIRES_IN', required: true },
  { name: 'JWT_REFRESH_EXPIRES_IN', required: true },
];

const failures = [];
const warnings = [];

for (const check of checks) {
  const value = env[check.name];
  if (check.required && !value) {
    failures.push(`${check.name}: missing`);
    continue;
  }
  if (!value) continue;
  if (check.expected && value !== check.expected) {
    failures.push(`${check.name}: expected ${check.expected}`);
  }
  if (check.minLength && value.length < check.minLength) {
    failures.push(`${check.name}: shorter than ${check.minLength}`);
  }
  if (check.disallow && check.disallow.includes(value)) {
    failures.push(`${check.name}: unsafe template/default value`);
  }
}

if (!env.CORS_ORIGIN) {
  warnings.push('CORS_ORIGIN: not set; production should restrict browser origins after a domain is available');
}

if (!env.OSS_BUCKET) {
  warnings.push('OSS_BUCKET: not set; product images will use local uploads');
}

console.log(`[env-check] source=${envPath || 'process.env'}`);
if (warnings.length > 0) {
  for (const warning of warnings) console.warn(`[env-check] warning: ${warning}`);
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`[env-check] fail: ${failure}`);
  process.exit(1);
}

console.log('[env-check] passed');
