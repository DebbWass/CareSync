import { supabase } from '../../lib/supabase';
import { normalizeSupabaseError } from './errors';
import type { Message } from '../../types';

export interface SendMessageInput {
  patient_id: string;
  caregiver_id: string;
  sender_id: string;
  body: string;
  /** Client-generated UUID — the idempotency key for outbox retries. */
  client_id: string;
}

/**
 * Send a message with exactly-once semantics: UNIQUE(sender_id, client_id)
 * in the database makes a retried send a 23505, which is treated as SUCCESS
 * here (the message already exists — the first attempt worked, only its
 * response was lost). Returns the inserted row, or null for the duplicate
 * case. Every other failure throws AppError.
 */
export async function sendMessage(input: SendMessageInput): Promise<Message | null> {
  const { data, error } = await supabase.from('messages').insert(input).select('*').single();

  if (error) {
    const appError = normalizeSupabaseError(error);
    if (appError.code === 'conflict') {
      // Duplicate client_id — the original send succeeded
      return null;
    }
    throw appError;
  }
  return data as Message;
}

/**
 * Conversation between one patient↔caregiver pair, oldest first.
 * Both members pass RLS; anyone else gets an empty result by policy.
 */
export async function getThread(patientId: string, caregiverId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('patient_id', patientId)
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: true });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as Message[];
}

/** Fetch one message with the sender's name (push-tap deep link target). */
export async function getMessageById(messageId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    // Three FKs point at users — the embed must name the sender constraint
    .select('*, sender:users!messages_sender_id_fkey(name)')
    .eq('id', messageId)
    .single();

  if (error) throw normalizeSupabaseError(error);
  return data as Message;
}

/**
 * Mark a message delivered. Guarded to status='sent' so a message already
 * read is untouched — the DB trigger would reject the backward move anyway;
 * the filter just avoids surfacing that as an error.
 */
export async function markMessageDelivered(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'delivered' })
    .eq('id', messageId)
    .eq('status', 'sent');

  if (error) throw normalizeSupabaseError(error);
}

/** Mark a single message read (patient popup acknowledge). */
export async function markMessageRead(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'read' })
    .eq('id', messageId)
    .neq('status', 'read');

  if (error) throw normalizeSupabaseError(error);
}

/**
 * Mark every unread incoming message in a thread as read (caregiver opens
 * the thread). RLS additionally restricts the update to rows where the
 * caller is the recipient; the sender filter keeps the intent explicit.
 */
export async function markThreadRead(
  patientId: string,
  caregiverId: string,
  readerId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'read' })
    .eq('patient_id', patientId)
    .eq('caregiver_id', caregiverId)
    .neq('sender_id', readerId)
    .neq('status', 'read');

  if (error) throw normalizeSupabaseError(error);
}
