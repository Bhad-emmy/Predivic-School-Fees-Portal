import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hashToken = async (token: string) => {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const makeReference = () =>
  "MEKA-" + crypto.randomUUID().replaceAll("-", "").toUpperCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey || !paystackSecret) {
    return json({ error: "Payment function configuration is incomplete." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const token = String(body.token || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const amount = Number(body.amount);

  if (!token || !email || !email.includes("@")) {
    return json({ error: "Payment link token and a valid email are required." }, 400);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Payment amount must be greater than zero." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await hashToken(token);
  const { data: link, error: linkError } = await admin
    .from("parent_payment_links")
    .select("id, school_id, student_id, student_fee_account_id, active, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !link || !link.active) {
    return json({ error: "Invalid or inactive payment link." }, 404);
  }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return json({ error: "This payment link has expired." }, 410);
  }

  const { data: account, error: accountError } = await admin
    .from("student_fee_accounts")
    .select("id, student_id, school_id, fee_account_id, total_amount, status")
    .eq("id", link.student_fee_account_id)
    .eq("student_id", link.student_id)
    .eq("school_id", link.school_id)
    .maybeSingle();

  if (accountError || !account) return json({ error: "Fee account not found." }, 404);

  const { data: schoolSettings, error: settingsError } = await admin
    .from("school_settings")
    .select("paystack_subaccount_code")
    .eq("school_id", link.school_id)
    .maybeSingle();

  if (settingsError) {
    console.error("PAYSTACK SCHOOL SETTINGS ERROR:", settingsError);
    return json({ error: "Unable to load school payment configuration." }, 500);
  }

  const subaccount = String(schoolSettings?.paystack_subaccount_code || "").trim();
  if (!subaccount) {
    return json({ error: "This school has no Paystack subaccount configured." }, 503);
  }

  const { data: paidRows, error: paidError } = await admin
    .from("payments")
    .select("amount, status")
    .eq("student_fee_account_id", account.id);

  if (paidError) return json({ error: "Unable to calculate outstanding balance." }, 500);

  const paid = (paidRows || [])
    .filter((row) => ["paid", "successful", "completed"].includes(String(row.status || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const balance = Math.max(Number(account.total_amount || 0) - paid, 0);
  if (balance <= 0) return json({ error: "This fee account is already paid." }, 409);
  if (amount > balance) {
    return json({ error: "Amount cannot exceed the current outstanding balance.", balance }, 400);
  }

  const reference = makeReference();
  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .insert({
      school_id: link.school_id,
      student_id: link.student_id,
      student_fee_account_id: account.id,
      parent_payment_link_id: link.id,
      amount,
      currency: "NGN",
      reference,
      status: "pending",
      metadata: { source: "parent_payment_link", link_id: link.id },
    })
    .select("id, reference")
    .single();

  if (intentError || !intent) {
    console.error("PAYMENT INTENT ERROR:", intentError);
    return json({ error: "Unable to create payment intent." }, 500);
  }

  const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "").replace(/\/$/, "");
  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + paystackSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency: "NGN",
      reference,
      callback_url: appUrl ? appUrl + "/pay?token=" + encodeURIComponent(token) + "&reference=" + encodeURIComponent(reference) : undefined,
      metadata: JSON.stringify({
        meka_payment_intent_id: intent.id,
        school_id: link.school_id,
        student_id: link.student_id,
        student_fee_account_id: account.id,
      }),
      subaccount,
      bearer: "subaccount",
    }),
  });

  const paystack = await paystackResponse.json();
  if (!paystackResponse.ok || !paystack?.status || !paystack?.data?.authorization_url) {
    await admin
      .from("payment_intents")
      .update({ status: "failed", paystack_status: "initialization_failed", gateway_response: paystack?.message || "Paystack initialization failed", updated_at: new Date().toISOString() })
      .eq("id", intent.id);
    console.error("PAYSTACK INITIALIZE ERROR:", paystack);
    return json({ error: "Paystack could not initialize the transaction." }, 502);
  }

  await admin
    .from("payment_intents")
    .update({
      paystack_reference: paystack.data.reference,
      paystack_access_code: paystack.data.access_code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intent.id);

  return json({
    authorizationUrl: paystack.data.authorization_url,
    accessCode: paystack.data.access_code,
    reference: paystack.data.reference,
    amount,
    balance,
  });
});