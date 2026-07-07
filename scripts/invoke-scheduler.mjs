/**
 * Invoke the medication-scheduler Edge Function on the LOCAL Supabase stack.
 *
 * pg_cron fires it every 5 minutes, which is painful to wait for during
 * development — this triggers one deterministic run and prints the result.
 *
 * Usage: npm run scheduler:run
 * Requires: `supabase start` running, and functions served by the local stack.
 */
import { execSync } from 'node:child_process';

function localServiceKey() {
  const out = execSync('supabase status -o json', { encoding: 'utf8' });
  const status = JSON.parse(out);
  const key = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY ?? status.service_role_key;
  if (!key) throw new Error('Could not read the local service key from `supabase status`');
  return key;
}

const key = localServiceKey();
const res = await fetch('http://127.0.0.1:54321/functions/v1/medication-scheduler', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: '{}',
});

const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body);
if (!res.ok) process.exit(1);
