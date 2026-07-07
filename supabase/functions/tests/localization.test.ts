import { assertEquals, assert } from '@std/assert';
import { notificationCopy } from '../_shared/localization.ts';

Deno.test('reminder copy localizes to Hebrew for he users', () => {
  const copy = notificationCopy('reminder', 'he');
  assertEquals(copy.title, 'תזכורת לתרופה');
});

Deno.test('unknown/null language falls back to English', () => {
  assertEquals(notificationCopy('reminder', null).title, 'Medication Reminder');
  assertEquals(notificationCopy('missed', 'fr').title, 'Missed Medication');
  assertEquals(notificationCopy('snoozed_limit', undefined).title, 'Snooze Limit Reached');
});

Deno.test('PHI rule: no copy interpolates names or dosages (static strings only)', () => {
  for (const kind of ['reminder', 'missed', 'snoozed_limit'] as const) {
    for (const lang of ['he', 'en']) {
      const copy = notificationCopy(kind, lang);
      assert(!copy.title.includes('{{') && !copy.body.includes('{{'));
    }
  }
});
