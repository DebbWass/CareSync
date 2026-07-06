import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOOKAHEAD_HOURS = 24;
const DUE_WINDOW_MINUTES = 10;
const MISSED_GRACE_MINUTES = 30;

type Medication = {
  id: string;
  patient_id: string;
};

type Schedule = {
  id: string;
  medication_id: string;
  times_of_day: string[];
  start_date: string;
  end_date: string | null;
};

function parseEventTime(baseDate: Date, timeHHMM: string): Date | null {
  const [hh, mm] = timeHHMM.split(":").map((part) => Number(part));
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  const date = new Date(baseDate);
  date.setHours(hh, mm, 0, 0);
  return date;
}

function withinRange(date: Date, min: Date, max: Date): boolean {
  return date.getTime() >= min.getTime() && date.getTime() <= max.getTime();
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

  const now = new Date();
  const lookahead = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const { data: medications, error: medsError } = await supabase
    .from("medications")
    .select("id, patient_id")
    .eq("is_active", true);

  if (medsError) {
    return new Response(JSON.stringify({ error: "Failed loading active medications", detail: medsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const medById = new Map<string, Medication>();
  for (const med of (medications ?? []) as Medication[]) {
    medById.set(med.id, med);
  }

  const { data: schedules, error: schedulesError } = await supabase
    .from("medication_schedules")
    .select("id, medication_id, times_of_day, start_date, end_date")
    .eq("is_active", true);

  if (schedulesError) {
    return new Response(JSON.stringify({ error: "Failed loading active schedules", detail: schedulesError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventRows: Array<{
    schedule_id: string;
    medication_id: string;
    patient_id: string;
    scheduled_time: string;
    status: "pending";
  }> = [];

  const dayOffsets = [0, 1, 2];
  for (const schedule of (schedules ?? []) as Schedule[]) {
    const medication = medById.get(schedule.medication_id);
    if (!medication) continue;

    for (const offset of dayOffsets) {
      const candidateDate = new Date(now);
      candidateDate.setDate(candidateDate.getDate() + offset);

      for (const slot of schedule.times_of_day ?? []) {
        const eventTime = parseEventTime(candidateDate, slot);
        if (!eventTime) continue;
        if (!withinRange(eventTime, now, lookahead)) continue;

        eventRows.push({
          schedule_id: schedule.id,
          medication_id: medication.id,
          patient_id: medication.patient_id,
          scheduled_time: eventTime.toISOString(),
          status: "pending",
        });
      }
    }
  }

  let generatedEvents = 0;
  if (eventRows.length > 0) {
    const { data: insertedEvents, error: insertError } = await supabase
      .from("medication_events")
      .upsert(eventRows, { onConflict: "schedule_id,scheduled_time", ignoreDuplicates: true })
      .select("id");

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed creating medication events", detail: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    generatedEvents = insertedEvents?.length ?? 0;
  }

  const dueMax = new Date(now.getTime() + DUE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: dueEvents, error: dueError } = await supabase
    .from("medication_events")
    .select("id, patient_id")
    .eq("status", "pending")
    .gte("scheduled_time", now.toISOString())
    .lte("scheduled_time", dueMax);

  if (dueError) {
    return new Response(JSON.stringify({ error: "Failed loading due events", detail: dueError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const patientIds = [...new Set((dueEvents ?? []).map((event) => event.patient_id))];
  let notificationsQueued = 0;

  if (patientIds.length) {
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", patientIds);

    const sends: Array<Promise<Response | null>> = [];

    for (const event of dueEvents ?? []) {
      const eventTokens = (tokens ?? []).filter((token) => token.user_id === event.patient_id);
      for (const token of eventTokens) {
        notificationsQueued += 1;
        sends.push(
          fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              token: token.token,
              title: "Time for your medication",
              body: "Open CareSync to confirm",
              data: {
                type: "reminder",
                event_id: event.id,
              },
            }),
          }).catch(() => null),
        );
      }
    }

    await Promise.allSettled(sends);
  }

  const missedCutoff = new Date(now.getTime() - MISSED_GRACE_MINUTES * 60 * 1000).toISOString();
  const { data: missedEvents, error: missedError } = await supabase
    .from("medication_events")
    .update({ status: "missed" })
    .eq("status", "pending")
    .lte("scheduled_time", missedCutoff)
    .select("id");

  if (missedError) {
    return new Response(JSON.stringify({
      generatedEvents,
      notificationsQueued,
      warning: `Failed to update missed events: ${missedError.message}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    generatedEvents,
    notificationsQueued,
    markedMissed: missedEvents?.length ?? 0,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
