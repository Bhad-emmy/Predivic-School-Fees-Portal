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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function configuration is incomplete." }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const accessToken = authorization.slice(7).trim();
  if (!accessToken) return json({ error: "Authentication required." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: "Authentication required." }, 401);

  const { data: staff, error: staffError } = await adminClient
    .from("teachers")
    .select("role, status, school_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (staffError || !staff) return json({ error: "Authenticated staff account was not found." }, 403);
  if (String(staff.status || "").toLowerCase() !== "active") {
    return json({ error: "This staff account is not active." }, 403);
  }
  if (String(staff.role || "").toLowerCase() !== "admin") {
    return json({ error: "Only an Admin can view student contact details." }, 403);
  }
  if (!staff.school_id) return json({ error: "Your staff account is not linked to a school." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = String(body.action || "get").trim().toLowerCase();
  if (!["get", "update"].includes(action)) {
    return json({ error: "Unsupported action." }, 400);
  }

  const studentId = String(body.studentId || "").trim();
  if (!studentId) return json({ error: "Student ID is required." }, 400);

  const { data: student, error: studentError } = await adminClient
    .from("students")
    .select("id, admission_no, first_name, middle_name, last_name, parent_name, parent_relationship, parent_phone, parent_email, address, secondary_parent_name, secondary_parent_phone, emergency_contact_name, emergency_contact_phone")
    .eq("id", studentId)
    .eq("school_id", staff.school_id)
    .maybeSingle();

  if (studentError) {
    console.error("STUDENT CONTACT LOOKUP ERROR:", studentError);
    return json({ error: "Unable to load student contact details." }, 500);
  }
  if (!student) return json({ error: "Student contact details were not found." }, 404);

  if (action === "update") {
    const updates: Record<string, string | null> = {};

    const fields: Record<string, string> = {
      parentName: "parent_name",
      parentRelationship: "parent_relationship",
      parentPhone: "parent_phone",
      parentEmail: "parent_email",
      address: "address",
      secondaryParentName: "secondary_parent_name",
      secondaryParentPhone: "secondary_parent_phone",
      emergencyContactName: "emergency_contact_name",
      emergencyContactPhone: "emergency_contact_phone",
    };

    for (const [inputKey, column] of Object.entries(fields)) {
      if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
        const value = String(body[inputKey] ?? "").trim();
        updates[column] = value || null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No contact fields were provided." }, 400);
    }

    const { data: updatedStudent, error: updateError } = await adminClient
      .from("students")
      .update(updates)
      .eq("id", studentId)
      .eq("school_id", staff.school_id)
      .select("id, admission_no, first_name, middle_name, last_name, parent_name, parent_relationship, parent_phone, parent_email, address, secondary_parent_name, secondary_parent_phone, emergency_contact_name, emergency_contact_phone")
      .single();

    if (updateError || !updatedStudent) {
      console.error("STUDENT CONTACT UPDATE ERROR:", updateError);
      return json({ error: "Unable to save student contact details." }, 500);
    }

    return json({
      id: updatedStudent.id,
      admissionNo: updatedStudent.admission_no || "",
      fullName: [updatedStudent.first_name, updatedStudent.middle_name, updatedStudent.last_name].filter(Boolean).join(" "),
      parentName: updatedStudent.parent_name || "",
      parentRelationship: updatedStudent.parent_relationship || "",
      parentPhone: updatedStudent.parent_phone || "",
      parentEmail: updatedStudent.parent_email || "",
      address: updatedStudent.address || "",
      secondaryParentName: updatedStudent.secondary_parent_name || "",
      secondaryParentPhone: updatedStudent.secondary_parent_phone || "",
      emergencyContactName: updatedStudent.emergency_contact_name || "",
      emergencyContactPhone: updatedStudent.emergency_contact_phone || "",
    });
  }

  return json({
    id: student.id,
    admissionNo: student.admission_no || "",
    fullName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
    parentName: student.parent_name || "",
    parentRelationship: student.parent_relationship || "",
    parentPhone: student.parent_phone || "",
    parentEmail: student.parent_email || "",
    address: student.address || "",
    secondaryParentName: student.secondary_parent_name || "",
    secondaryParentPhone: student.secondary_parent_phone || "",
    emergencyContactName: student.emergency_contact_name || "",
    emergencyContactPhone: student.emergency_contact_phone || "",
  });
});