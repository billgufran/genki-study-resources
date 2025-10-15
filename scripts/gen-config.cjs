#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const rootDir = process.cwd();
const envPath = path.resolve(rootDir, '.env');
const outputPath = path.resolve(rootDir, 'resources/javascript/config.js');

const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && value !== undefined && !(key in env)) {
      env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  });
}

const missing = ENV_KEYS.filter((key) => !env[key]);
if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'Provide them via .env or your shell before running this script.'
  );
  process.exit(1);
}

const config = {
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY
};

const fileBody = `(function (target) {
  var config = ${JSON.stringify(config, null, 2)};
  if (typeof globalThis !== 'undefined') {
    globalThis.GENKI_CONFIG = config;
  }
  if (target && !target.GENKI_CONFIG) {
    target.GENKI_CONFIG = config;
  }
})(typeof window !== 'undefined' ? window : self);
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, fileBody, 'utf8');

console.log(`Supabase config generated at ${path.relative(rootDir, outputPath)}.`);
