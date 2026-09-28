import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
};

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

const verifySignature = async (rawBody: string, signature: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  return timingSafeEqual(digest, hexToBytes(signature));
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook configuration is incomplete." }, 500);
  }

  const signature = req.headers.get("x-paystack-signature") || "";
  const rawBody = await req.text();
  if (!signature || !(await verifySignature(rawBody, signature, secret))) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventName = String(event.event || "");
  const data = event.data || {};
  const reference = String(data.reference || "").trim();
  if (!reference) return json({ received: true, ignored: true });

  if (eventName !== "charge.success") {
    if (["charge.failed", "charge.abandoned"].includes(eventName)) {
      await admin
        .from("payment_intents")
        .update({
          status: eventName === "charge.failed" ? "failed" : "abandoned",
          paystack_reference: reference,
          paystack_status: String(data.status || eventName),
          gateway_response: String(data.gateway_response || data.message || ""),
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference)
        .neq("status", "paid");
    }
    return json({ received: true });
  }

  // Verify the transaction directly with Paystack before delivering value.
  const verifyResponse = await fetch(
    "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
    {
      headers: { Authorization: "Bearer " + secret },
    },
  );
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok || !verified?.status || verified?.data?.status !== "success") {
    console.error("PAYSTACK VERIFY FAILED:", verified);
    return json({ error: "Paystack verification failed." }, 502);
  }

  const tx = verified.data;
  const { data: finalized, error: finalizeError } = await admin.rpc(
    "finalize_paystack_payment",
    {
      p_reference: reference,
      p_paystack_transaction_id: Number(tx.id),
      p_amount_kobo: Number(tx.amount),
      p_currency: String(tx.currency || ""),
      p_paystack_status: String(tx.status || ""),
      p_channel: String(tx.channel || ""),
      p_gateway_response: String(tx.gateway_response || ""),
      p_paid_at: tx.paid_at || tx.paidAt || null,
    },
  );

  if (finalizeError) {
    console.error("PAYSTACK FINALIZE ERROR:", finalizeError);
    return json({ error: "Payment could not be finalized." }, 500);
  }

  return json({ received: true, finalized: finalized?.[0] || null });
});