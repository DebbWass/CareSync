/**
 * Verify postgres_changes delivery WITH RLS on the local stack (M8).
 *
 * The M9 client will rely on realtime message delivery to an AUTHENTICATED
 * user whose visibility is constrained by RLS — the one integration the
 * approved plan flagged as "verify early". This script proves it end to end:
 *
 *   1. Sign in as the seed patient (anon key + password → RLS applies).
 *   2. Subscribe to postgres_changes INSERTs on `messages`.
 *   3. Sign in as the seed caregiver and send a message to the patient.
 *   4. PASS if the patient's subscription receives the event within 10s.
 *
 * Usage: npm run verify:realtime   (requires `supabase start`)
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

// No root node_modules — resolve supabase-js from the mobile app's tree
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const LOCAL_URL = 'http://127.0.0.1:54321';
const PATIENT = { email: 'patient@caresync.test', password: 'Password123!' };
const CAREGIVER = { email: 'caregiver@caresync.test', password: 'Password123!' };

function localAnonKey() {
  const out = execSync('supabase status -o json', { encoding: 'utf8' });
  const status = JSON.parse(out);
  const key = status.ANON_KEY ?? status.PUBLISHABLE_KEY ?? status.anon_key;
  if (!key) throw new Error('Could not read the local anon key from `supabase status`');
  return key;
}

function fail(reason) {
  console.error(`FAIL: ${reason}`);
  process.exit(1);
}

const anonKey = localAnonKey();

// ── 1. Patient session (RLS-constrained) ──────────────────────────────────────
const patientClient = createClient(LOCAL_URL, anonKey);
const { data: patientAuth, error: pErr } =
  await patientClient.auth.signInWithPassword(PATIENT);
if (pErr) fail(`patient sign-in: ${pErr.message}`);
const patientId = patientAuth.user.id;

// CRITICAL (the M9 client must do this too): the realtime socket must carry
// the AUTHENTICATED token before subscribing. supabase-js propagates it via
// onAuthStateChange, but that dispatch can race a subscribe() that follows
// sign-in immediately — the channel then joins as `anon`, WALRUS evaluates
// RLS against anon, and events are silently withheld.
await patientClient.realtime.setAuth(patientAuth.session.access_token);

// ── 2. Subscribe to message INSERTs as the patient ───────────────────────────
let received = null;
const channel = patientClient
  .channel('verify-messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      received = payload.new;
    }
  );

await new Promise((resolve, reject) => {
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') resolve();
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      reject(new Error(`subscribe: ${status} ${err ?? ''}`));
    }
  });
}).catch((e) => fail(e.message));

console.log('patient subscribed to postgres_changes on messages (RLS active)');

// ── 3. Caregiver sends a message ─────────────────────────────────────────────
const caregiverClient = createClient(LOCAL_URL, anonKey);
const { data: caregiverAuth, error: cErr } =
  await caregiverClient.auth.signInWithPassword(CAREGIVER);
if (cErr) fail(`caregiver sign-in: ${cErr.message}`);

const { data: inserted, error: insErr } = await caregiverClient
  .from('messages')
  .insert({
    patient_id: patientId,
    caregiver_id: caregiverAuth.user.id,
    sender_id: caregiverAuth.user.id,
    body: 'realtime verification message',
    client_id: crypto.randomUUID(),
  })
  .select('id')
  .single();
if (insErr) fail(`caregiver insert: ${insErr.message}`);
console.log(`caregiver inserted message ${inserted.id}`);

// ── 4. Await delivery ─────────────────────────────────────────────────────────
const deadline = Date.now() + 10_000;
while (!received && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 200));
}

await patientClient.removeAllChannels();

if (!received) {
  fail('patient did NOT receive the realtime event within 10s (RLS + realtime broken?)');
}
if (received.id !== inserted.id) {
  fail(`received a different row (${received.id}) than inserted (${inserted.id})`);
}
console.log('PASS: postgres_changes delivered to an RLS-constrained authenticated user');
process.exit(0);
