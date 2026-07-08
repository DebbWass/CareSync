/**
 * message-push — Database Webhook Edge Function (M8)
 *
 * Triggered by a DB webhook on INSERT into `messages`.
 * Sends a push notification to the recipient (the pair member who did not
 * send the message).
 *
 * PHI rule: the push contains NO message body and no names — only
 * { type: 'message', message_id }. The app fetches the content after the tap
 * (fullscreen popup for patients lands in M9).
 *
 * Request body (Supabase DB webhook format):
 *   { type: "INSERT", table: "messages", record: {...} }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificationCopy } from '../_shared/localization.ts';
import { resolveRecipient, channelForRecipient, type MessageRecord } from './logic.ts';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: MessageRecord;
  schema: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'messages' || !payload.record) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const record = payload.record;
  const recipientId = resolveRecipient(record);

  if (!recipientId) {
    return new Response(JSON.stringify({ skipped: true, reason: 'sender outside pair' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Localize per recipient (users.language)
  const { data: recipient } = await supabase
    .from('users')
    .select('language')
    .eq('id', recipientId)
    .single();

  const copy = notificationCopy('message', recipient?.language);

  let notifications_sent = 0;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id: recipientId,
        title: copy.title,
        body: copy.body,
        // data.type MUST be 'message' — the app's notification-tap handler
        // routes on it (payload contract, design decision #6)
        data: {
          type: 'message',
          message_id: record.id,
        },
        channel: channelForRecipient(record, recipientId),
      }),
    });

    if (res.ok) {
      notifications_sent = 1;
    } else {
      console.error('[message-push] send-push failed for recipient', recipientId, res.status);
    }
  } catch (err) {
    console.error('[message-push] send-push error for recipient', recipientId, err);
  }

  return new Response(JSON.stringify({ notifications_sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
