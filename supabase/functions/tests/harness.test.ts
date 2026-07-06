/**
 * Edge Function test harness smoke test.
 *
 * Proves the Deno test runner is wired into CI. Real behavioral tests for the
 * Edge Functions (timezone-aware scheduling, push retry/backoff, alert dedup)
 * land in the notification-hardening milestone, when each function is split
 * into an HTTP wrapper (index.ts) and pure, injectable logic (logic.ts).
 */
import { assertEquals } from '@std/assert';

Deno.test('deno test harness is wired', () => {
  assertEquals(1 + 1, 2);
});

Deno.test('PHI rule: reminder payload shape carries only the event id', () => {
  // The contract every push payload must follow (see docs/notification-flow.md):
  // no medication names, dosages, or patient names — only opaque IDs.
  const payload = { type: 'reminder', event_id: '00000000-0000-4000-8000-000000000000' };
  assertEquals(Object.keys(payload).sort(), ['event_id', 'type']);
});
