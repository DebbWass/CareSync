import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendPushBody = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SendPushBody;
  try {
    payload = (await req.json()) as SendPushBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload?.token || !payload?.title || !payload?.body) {
    return new Response(JSON.stringify({ error: "token, title and body are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // This baseline implementation supports Expo push tokens.
  // Non-Expo provider tokens are rejected explicitly to avoid silent delivery failures.
  if (!isExpoPushToken(payload.token)) {
    return new Response(
      JSON.stringify({
        accepted: false,
        reason: "unsupported_token_provider",
        detail: "Only Expo push tokens are supported by send-push baseline implementation.",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: payload.token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
      channelId: "medications",
    }),
  });

  const responseBody = await expoResponse.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      accepted: expoResponse.ok,
      provider: "expo",
      providerStatus: expoResponse.status,
      providerResponse: responseBody,
    }),
    {
      status: expoResponse.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
