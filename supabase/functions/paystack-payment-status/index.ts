import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed." }, 405);

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Payment confirmation is not configured." }, 500);
  }

  let reference = new URL(req.url).searchParams.get("reference")?.trim() || "";\n  if (req.method === "POST") {\n    try {\n      const body = await req.json();\n      reference = String(body?.reference || reference).trim();\n    } catch {\n      return json({ error: "Invalid request body." }, 400);\n    }\n  }
  if (!/^MEKA-[A-Z0-9-]+$/i.test(reference)) {
    return json({ error: "Invalid payment reference." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: intent } = await admin
    .from("payment_intents")
    .select("id, status, reference")
    .eq("reference", reference)
    .maybeSingle();

  if (!intent) return json({ error: "Payment not found." }, 404);

  if (intent.status === "paid") {
    return json({ status: "paid", reference });
  }

  const verifyResponse = await fetch(
    "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
    { headers: { Authorization: "Bearer " + secret } },
  );
  const verified = await verifyResponse.json();

  if (!verifyResponse.ok || !verified?.status) {
    return json({ error: "Unable to verify payment with Paystack." }, 502);
  }

  const tx = verified.data;
  if (tx?.status !== "success") {
    return json({
      status: String(tx?.status || "pending"),
      reference,
    });
  }

  const { data: finalized, error } = await admin.rpc("finalize_paystack_payment", {
    p_reference: reference,
    p_paystack_transaction_id: Number(tx.id),
    p_amount_kobo: Number(tx.amount),
    p_currency: String(tx.currency || ""),
    p_paystack_status: String(tx.status || ""),
    p_channel: String(tx.channel || ""),
    p_gateway_response: String(tx.gateway_response || ""),
    p_paid_at: tx.paid_at || tx.paidAt || null,
  });

  if (error) {
    console.error("PAYSTACK CONFIRMATION ERROR:", error);
    return json({ error: "Payment was verified but could not be recorded." }, 500);
  }

  return json({
    status: "paid",
    reference,
    finalized: finalized?.[0] || null,
  });
});
