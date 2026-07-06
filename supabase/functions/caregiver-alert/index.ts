import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SNOOZE_LIMIT = 3;

type WebhookPayload = {
  record?: {
    id: string;
    patient_id: string;
    status: "pending" | "taken" | "snoozed" | "missed";
    snooze_count: number;
  };
};

function getAlertType(status: string, snoozeCount: number): "missed" | "snoozed_limit" | null {
  if (status === "missed") return "missed";
  if (status === "snoozed" && snoozeCount >= SNOOZE_LIMIT) return "snoozed_limit";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase service-role environment variables" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = payload.record;
  if (!event?.id || !event.patient_id) {
    return new Response(JSON.stringify({ ignored: true, reason: "missing_event_record" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const alertType = getAlertType(event.status, event.snooze_count ?? 0);
  if (!alertType) {
    return new Response(JSON.stringify({ ignored: true, reason: "status_not_alertable" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: caregivers, error: caregiverError } = await supabase
    .from("patient_caregiver_relationships")
    .select("caregiver_id")
    .eq("patient_id", event.patient_id)
    .eq("status", "active");

  if (caregiverError) {
    return new Response(JSON.stringify({ error: "Failed to load caregivers", detail: caregiverError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const caregiverIds = (caregivers ?? []).map((row) => row.caregiver_id);
  if (!caregiverIds.length) {
    return new Response(JSON.stringify({ alertsCreated: 0, notificationsQueued: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const alertRows = caregiverIds.map((caregiverId) => ({
    patient_id: event.patient_id,
    caregiver_id: caregiverId,
    event_id: event.id,
    alert_type: alertType,
    is_read: false,
  }));

  const { data: insertedAlerts, error: alertInsertError } = await supabase
    .from("alerts")
    .insert(alertRows)
    .select("id, caregiver_id");

  if (alertInsertError) {
    return new Response(JSON.stringify({ error: "Failed to create alerts", detail: alertInsertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tokens, error: tokenError } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", caregiverIds);

  if (tokenError) {
    return new Response(JSON.stringify({
      alertsCreated: insertedAlerts?.length ?? 0,
      notificationsQueued: 0,
      warning: tokenError.message,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sends = (tokens ?? []).map((tokenRow) => {
    const matchedAlert = insertedAlerts?.find((alert) => alert.caregiver_id === tokenRow.user_id);

    return fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        token: tokenRow.token,
        title: "Medication alert",
        body: "A patient may need your attention",
        data: {
          type: "alert",
          alert_id: matchedAlert?.id ?? null,
          patient_id: event.patient_id,
        },
      }),
    }).catch(() => null);
  });

  await Promise.allSettled(sends);

  return new Response(JSON.stringify({
    alertsCreated: insertedAlerts?.length ?? 0,
    notificationsQueued: tokens?.length ?? 0,
    alertType,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
