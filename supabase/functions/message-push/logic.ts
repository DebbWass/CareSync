/**
 * message-push pure logic — unit-tested without network or Deno.serve.
 */

export interface MessageRecord {
  id: string;
  patient_id: string;
  caregiver_id: string;
  sender_id: string;
  status: 'sent' | 'delivered' | 'read';
}

/**
 * The push goes to the pair member who did NOT send the message.
 * Returns null for a malformed record (sender outside the pair) — the DB
 * CHECK makes that impossible via SQL, but a webhook payload is still
 * external input to this function.
 */
export function resolveRecipient(record: MessageRecord): string | null {
  if (record.sender_id === record.patient_id) return record.caregiver_id;
  if (record.sender_id === record.caregiver_id) return record.patient_id;
  return null;
}

/**
 * Android channel per recipient role: the patient's channel is MAX importance
 * (fullscreen intent — urgent messages must break through like reminders);
 * caregivers get the standard HIGH alerts channel.
 */
export function channelForRecipient(record: MessageRecord, recipientId: string): string {
  return recipientId === record.patient_id ? 'medications' : 'alerts';
}
