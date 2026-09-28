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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuration is incomplete." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const token = String(body.token || "").trim();
  if (!token) return json({ error: "Payment token is required." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await hashToken(token);
  const { data: link, error: linkError } = await admin
    .from("parent_payment_links")
    .select("id, school_id, student_id, student_fee_account_id, active, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !link || !link.active) return json({ error: "Invalid or inactive payment link." }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return json({ error: "This payment link has expired." }, 410);
  }

  const [{ data: school, error: schoolError }, { data: student, error: studentError }, { data: account, error: accountError }] =
    await Promise.all([
      admin.from("schools").select("id, name").eq("id", link.school_id).maybeSingle(),
      admin.from("students").select("id, first_name, middle_name, last_name, admission_no").eq("id", link.student_id).eq("school_id", link.school_id).maybeSingle(),
      admin.from("student_fee_accounts").select("id, total_amount, status").eq("id", link.student_fee_account_id).eq("student_id", link.student_id).eq("school_id", link.school_id).maybeSingle(),
    ]);

  if (schoolError || studentError || accountError || !school || !student || !account) {
    return json({ error: "Payment information could not be loaded." }, 500);
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

  return json({
    school: school.name,
    student: {
      id: student.id,
      name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
      admissionNo: student.admission_no || "",
    },
    totalFee: Number(account.total_amount || 0),
    paid,
    balance,
    status: account.status,
  });
});