/**
 * send-push — HTTP Edge Function
 *
 * Sends a push notification to all active devices for a given user_id.
 * Uses the Expo Push API (https://exp.host/--/api/v2/push/send).
 *
 * PHI rule: never log or expose medication names, dosages, or patient names.
 * The caller is responsible for ensuring `body` contains no PHI.
 *
 * Request body:
 *   {
 *     user_id: string,
 *     title: string,
 *     body: string,
 *     data?: { type: string, event_id?: string, alert_id?: string, patient_id?: string },
 *     channel?: string          // Android channel name (default: "medications")
 *   }
 *
 * Response:
 *   { sent: number, failed: number, removed_stale: number }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_CHANNEL = 'medications';

interface SendPushRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channel?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  sound?: 'default';
  priority?: 'high' | 'normal' | 'default';
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req) => {
  // Health check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: SendPushRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user_id, title, body, data, channel } = payload;

  if (!user_id || !title || !body) {
    return new Response(
      JSON.stringify({ error: 'user_id, title, and body are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Use service_role key — bypasses RLS to read push_tokens for any user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch all push tokens for the user
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('user_id', user_id);

  if (tokenError) {
    console.error('[send-push] Failed to fetch tokens:', tokenError.message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch push tokens' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!tokens || tokens.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, removed_stale: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    channelId: channel ?? DEFAULT_CHANNEL,
    sound: 'default',
    priority: 'high',
  }));

  // Send to Expo Push API (batch up to 100 per request)
  const BATCH_SIZE = 100;
  const tickets: ExpoTicket[] = [];
  const tokenIds = tokens.map((t) => t.id);

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.error('[send-push] Expo API error:', res.status, await res.text());
        // Mark all in batch as error
        batch.forEach(() => tickets.push({ status: 'error', message: 'HTTP error from Expo' }));
        continue;
      }

      const result = await res.json() as { data: ExpoTicket[] };
      tickets.push(...(result.data ?? []));
    } catch (err) {
      console.error('[send-push] Network error:', err);
      batch.forEach(() => tickets.push({ status: 'error', message: 'Network error' }));
    }
  }

  // Count results and collect stale token IDs to remove
  let sent = 0;
  let failed = 0;
  const staleTokenIds: string[] = [];

  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      // DeviceNotRegistered means the token is no longer valid
      const errCode = (ticket as ExpoPushReceipt).details?.error;
      if (errCode === 'DeviceNotRegistered' && i < tokenIds.length) {
        staleTokenIds.push(tokenIds[i]);
      }
    }
  });

  // Remove stale tokens so we don't waste future requests
  let removed_stale = 0;
  if (staleTokenIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_tokens')
      .delete()
      .in('id', staleTokenIds);

    if (deleteError) {
      console.error('[send-push] Failed to remove stale tokens:', deleteError.message);
    } else {
      removed_stale = staleTokenIds.length;
    }
  }

  return new Response(
    JSON.stringify({ sent, failed, removed_stale }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
