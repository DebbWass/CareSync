/**
 * Chaos smoke for the pipeline's healthcare-compliance invariants (M11).
 *
 * The pgTAP suite proves these at the SQL layer; this proves they survive abuse
 * through the SAME PostgREST surface the app uses, as a pre-release smoke. Every
 * scenario tries to BREAK an invariant and passes only if the database refuses:
 *
 *   1. Idempotent dose generation — a duplicate (schedule_id, scheduled_time)
 *      is rejected (23505), so a double-firing scheduler can't create dup doses.
 *   2. Audit-log immutability — DELETE on medication_events is blocked even for
 *      service_role (trigger, not just RLS).
 *   3. Audit-log immutability — UPDATE of a frozen column (scheduled_time) is
 *      blocked even for service_role.
 *   4. Message exactly-once — a duplicate (sender_id, client_id) is rejected
 *      (23505); the offline outbox relies on "the duplicate IS the success".
 *   5. Alert dedup — a duplicate (caregiver_id, event_id, alert_type) is
 *      rejected (23505), so a double-fired webhook is a no-op.
 *
 * Usage: npm run chaos   (requires `supabase start`)
 * Exit 0 only if every invariant held under abuse.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

// No root node_modules — resolve supabase-js from the mobile app's tree.
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const LOCAL_URL = 'http://127.0.0.1:54321';

function localKeys() {
  const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8' }));
  const service = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY ?? status.service_role_key;
  const anon = status.ANON_KEY ?? status.PUBLISHABLE_KEY ?? status.anon_key;
  if (!service || !anon) throw new Error('Could not read local keys from `supabase status`');
  return { service, anon };
}

const { service, anon } = localKeys();
const admin = createClient(LOCAL_URL, service, { auth: { persistSession: false } });

let failures = 0;
function check(name, held, detail) {
  if (held) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Fixtures: grab one real event + one real alert from the seeded data ───────
const { data: event, error: evErr } = await admin
  .from('medication_events')
  .select('id, schedule_id, medication_id, patient_id, scheduled_time')
  .limit(1)
  .single();
if (evErr || !event) {
  console.error(`setup: could not read a seeded medication_event (${evErr?.message}).`);
  console.error('Run `npm run db:reset` against the local stack first.');
  process.exit(1);
}

const { data: alert } = await admin
  .from('alerts')
  .select('patient_id, caregiver_id, event_id, alert_type')
  .limit(1)
  .single();

// ── 1. Duplicate dose rejected (idempotent generation) ────────────────────────
{
  const { error } = await admin.from('medication_events').insert({
    schedule_id: event.schedule_id,
    medication_id: event.medication_id,
    patient_id: event.patient_id,
    scheduled_time: event.scheduled_time, // collides with the existing row
    status: 'pending',
  });
  check('duplicate (schedule_id, scheduled_time) is rejected', error?.code === '23505', error?.code);
}

// ── 2. DELETE on the audit log is blocked (even for service_role) ─────────────
{
  const { error } = await admin.from('medication_events').delete().eq('id', event.id);
  check('DELETE on medication_events is blocked', !!error, error ? error.message : 'DELETE succeeded');
  // Belt-and-braces: confirm the row is still there.
  const { data: still } = await admin
    .from('medication_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  check('the audit row survived the DELETE attempt', !!still);
}

// ── 3. UPDATE of a frozen column is blocked (even for service_role) ───────────
{
  const shifted = new Date(new Date(event.scheduled_time).getTime() + 60_000).toISOString();
  const { error } = await admin
    .from('medication_events')
    .update({ scheduled_time: shifted })
    .eq('id', event.id);
  check('UPDATE of medication_events.scheduled_time is blocked', !!error, error ? error.message : 'UPDATE succeeded');
}

// ── 4. Message exactly-once — duplicate (sender_id, client_id) rejected ───────
if (alert) {
  const clientId = crypto.randomUUID(); // client_id is a UUID column
  const row = {
    patient_id: alert.patient_id,
    caregiver_id: alert.caregiver_id,
    sender_id: alert.caregiver_id,
    body: 'chaos idempotency probe',
    client_id: clientId,
  };
  const first = await admin.from('messages').insert(row);
  const second = await admin.from('messages').insert(row); // same client_id
  check(
    'duplicate (sender_id, client_id) message is rejected',
    !first.error && second.error?.code === '23505',
    first.error ? `first insert failed: ${first.error.message}` : second.error?.code
  );
}

// ── 5. Alert dedup — duplicate (caregiver_id, event_id, alert_type) rejected ──
if (alert && alert.event_id) {
  const { error } = await admin.from('alerts').insert({
    patient_id: alert.patient_id,
    caregiver_id: alert.caregiver_id,
    event_id: alert.event_id,
    alert_type: alert.alert_type,
  });
  check('duplicate (caregiver_id, event_id, alert_type) alert is rejected', error?.code === '23505', error?.code);
} else {
  console.log('SKIP: alert dedup (no seeded alert with an event_id)');
}

// ── Verdict ───────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`CHAOS FAILED: ${failures} invariant(s) broke under abuse.`);
  process.exit(1);
}
console.log('CHAOS PASSED: every compliance invariant held under abuse.');
process.exit(0);
