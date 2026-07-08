/**
 * message-push logic tests (M8): recipient resolution and channel selection.
 * The push payload contract itself (no PHI, {type:'message', message_id})
 * lives in index.ts and is enforced by review + the client-side types.
 */
import { assertEquals } from 'jsr:@std/assert';
import { resolveRecipient, channelForRecipient } from '../message-push/logic.ts';
import { notificationCopy } from '../_shared/localization.ts';

const base = {
  id: 'msg-1',
  patient_id: 'patient-1',
  caregiver_id: 'caregiver-1',
  status: 'sent' as const,
};

Deno.test('patient sends → caregiver receives', () => {
  assertEquals(resolveRecipient({ ...base, sender_id: 'patient-1' }), 'caregiver-1');
});

Deno.test('caregiver sends → patient receives', () => {
  assertEquals(resolveRecipient({ ...base, sender_id: 'caregiver-1' }), 'patient-1');
});

Deno.test('sender outside the pair → null (malformed webhook payload)', () => {
  assertEquals(resolveRecipient({ ...base, sender_id: 'intruder-9' }), null);
});

Deno.test('patient recipient gets the MAX-importance medications channel', () => {
  const record = { ...base, sender_id: 'caregiver-1' };
  assertEquals(channelForRecipient(record, 'patient-1'), 'medications');
});

Deno.test('caregiver recipient gets the standard alerts channel', () => {
  const record = { ...base, sender_id: 'patient-1' };
  assertEquals(channelForRecipient(record, 'caregiver-1'), 'alerts');
});

Deno.test('message copy is localized and PHI-free', () => {
  const he = notificationCopy('message', 'he');
  const en = notificationCopy('message', 'en');
  const fallback = notificationCopy('message', null);

  assertEquals(he.title, 'הודעה דחופה');
  assertEquals(en.title, 'Urgent Message');
  assertEquals(fallback.title, en.title);
  // Generic by design — nothing user-specific can leak into these strings
  for (const copy of [he, en]) {
    assertEquals(copy.body.includes('{{'), false);
  }
});
