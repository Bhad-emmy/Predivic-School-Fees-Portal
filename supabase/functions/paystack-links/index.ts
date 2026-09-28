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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Authentication required." }, 401);
  }

  const accessToken = authorization.slice(7).trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function configuration is incomplete." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: "Authentication required." }, 401);

  const { data: staff, error: staffError } = await admin
    .from("teachers")
    .select("id, role, status, school_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (staffError || !staff) return json({ error: "Staff account not found." }, 403);
  if (String(staff.status || "").toLowerCase() !== "active") {
    return json({ error: "Staff account is not active." }, 403);
  }
  if (!["admin", "secretary"].includes(String(staff.role || "").toLowerCase())) {
    return json({ error: "Only Admin or Secretary can create parent payment links." }, 403);
  }
  if (!staff.school_id) return json({ error: "Staff account is not linked to a school." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const studentFeeAccountId = String(body.studentFeeAccountId || "").trim();
  if (!studentFeeAccountId) return json({ error: "Student fee account is required." }, 400);

  const { data: account, error: accountError } = await admin
    .from("student_fee_accounts")
    .select("id, student_id, school_id, total_amount, status")
    .eq("id", studentFeeAccountId)
    .eq("school_id", staff.school_id)
    .maybeSingle();

  if (accountError || !account) return json({ error: "Student fee account not found." }, 404);

  const { data: paidRows, error: paidError } = await admin
    .from("payments")
    .select("amount, status")
    .eq("student_fee_account_id", account.id);

  if (paidError) return json({ error: "Unable to calculate outstanding balance." }, 500);

  const paid = (paidRows || [])
    .filter((row) => ["paid", "successful", "completed"].includes(String(row.status || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const balance = Math.max(Number(account.total_amount || 0) - paid, 0);
  if (balance <= 0) return json({ error: "This fee account has no outstanding balance." }, 409);

  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const tokenHash = await hashToken(token);

  const { data: link, error: linkError } = await admin
    .from("parent_payment_links")
    .insert({
      school_id: staff.school_id,
      student_id: account.student_id,
      student_fee_account_id: account.id,
      token_hash: tokenHash,
      created_by: authData.user.id,
    })
    .select("id, expires_at")
    .single();

  if (linkError || !link) {
    console.error("PARENT PAYMENT LINK ERROR:", linkError);
    return json({ error: "Unable to create payment link." }, 500);
  }

  const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "").replace(/\/$/, "");
  if (!appUrl) {
    return json({
      error: "PUBLIC_APP_URL is not configured.",
      linkId: link.id,
      token,
    }, 500);
  }

  return json({
    linkId: link.id,
    url: appUrl + "/pay?token=" + encodeURIComponent(token),
    expiresAt: link.expires_at,
    balance,
  });
});