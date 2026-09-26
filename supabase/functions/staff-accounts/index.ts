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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function configuration is incomplete." }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Authentication required." }, 401);
  }

  const accessToken = authorization.slice(7).trim();
  if (!accessToken) {
    return json({ error: "Authentication required." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } =
    await adminClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return json({ error: "Authentication required." }, 401);
  }

  const { data: authenticatedStaff, error: staffError } = await adminClient
    .from("teachers")
    .select("id, employee_no, first_name, middle_name, last_name, email, role, status, auth_user_id, school_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (staffError || !authenticatedStaff) {
    return json({ error: "Authenticated staff account was not found." }, 403);
  }

  if (String(authenticatedStaff.status || "").toLowerCase() !== "active") {
    return json({ error: "This staff account is not active." }, 403);
  }

  if (String(authenticatedStaff.role || "").toLowerCase() !== "admin") {
    return json({ error: "Only an Admin can manage staff accounts." }, 403);
  }

  const schoolId = authenticatedStaff.school_id;
  if (!schoolId) {
    return json({ error: "Your staff account is not linked to a school." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = String(body.action || "").trim().toLowerCase();

  try {
    if (action === "list") {
      const { data: staff, error: listError } = await adminClient
        .from("teachers")
        .select("id, employee_no, first_name, middle_name, last_name, email, role, status, auth_user_id, created_at, updated_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: true });

      if (listError) throw listError;

      const teacherIds = (staff || [])
        .filter((item) => String(item.role || "").toLowerCase() === "teacher")
        .map((item) => item.id);

      let assignments: Array<{ teacher_id: string; class_id: string }> = [];

      if (teacherIds.length > 0) {
        const { data, error: assignmentError } = await adminClient
          .from("teacher_class_assignments")
          .select("teacher_id, class_id")
          .eq("school_id", schoolId)
          .in("teacher_id", teacherIds);

        if (assignmentError) throw assignmentError;
        assignments = data || [];
      }

      const classIds = [...new Set(assignments.map((item) => item.class_id).filter(Boolean))];

      let classes: Array<{ id: string; name: string }> = [];

      if (classIds.length > 0) {
        const { data, error: classError } = await adminClient
          .from("classes")
          .select("id, name")
          .eq("school_id", schoolId)
          .in("id", classIds);

        if (classError) throw classError;
        classes = data || [];
      }

      const classMap = new Map(classes.map((item) => [item.id, item.name]));
      const assignmentsMap = new Map<string, Array<{ id: string; name: string }>>();

      for (const assignment of assignments) {
        if (!assignmentsMap.has(assignment.teacher_id)) {
          assignmentsMap.set(assignment.teacher_id, []);
        }
        assignmentsMap.get(assignment.teacher_id)!.push({
          id: assignment.class_id,
          name: classMap.get(assignment.class_id) || "Unknown Class",
        });
      }

      return json(
        (staff || []).map((item) => ({
          id: item.id,
          employeeNo: item.employee_no,
          firstName: item.first_name,
          middleName: item.middle_name,
          lastName: item.last_name,
          fullName: [item.first_name, item.middle_name, item.last_name]
            .filter(Boolean)
            .join(" "),
          email: item.email,
          role: item.role,
          status: item.status,
          hasAuthAccount: Boolean(item.auth_user_id),
          classes: assignmentsMap.get(item.id) || [],
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      );
    }

    if (action === "create") {
      const employeeNo = String(body.employeeNo || "").trim();
      const firstName = String(body.firstName || "").trim();
      const middleName = String(body.middleName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = String(body.role || "").trim();
      const requestedClassIds = Array.isArray(body.classIds)
        ? [...new Set(body.classIds.map(String).filter(Boolean))]
        : [];

      if (!employeeNo) return json({ error: "Employee number is required." }, 400);
      if (!firstName || !lastName) return json({ error: "First name and last name are required." }, 400);
      if (!email) return json({ error: "Email is required." }, 400);
      if (password.length < 8) return json({ error: "Password must contain at least 8 characters." }, 400);
      if (!["Admin", "Secretary", "Teacher"].includes(role)) {
        return json({ error: "Role must be Admin, Secretary, or Teacher." }, 400);
      }
      if (role === "Teacher" && requestedClassIds.length === 0) {
        return json({ error: "At least one class must be assigned to a Teacher." }, 400);
      }
      if (role !== "Teacher" && requestedClassIds.length > 0) {
        return json({ error: "Classes can only be assigned to Teacher accounts." }, 400);
      }

      const { data: existingStaff, error: existingStaffError } = await adminClient
        .from("teachers")
        .select("id, employee_no, email, auth_user_id, school_id")
        .eq("school_id", schoolId)
        .or(`employee_no.eq.${employeeNo},email.ilike.${email}`)
        .limit(10);

      if (existingStaffError) throw existingStaffError;

      const duplicateEmployee = (existingStaff || []).find(
        (item) => String(item.employee_no || "").toLowerCase() === employeeNo.toLowerCase(),
      );
      const duplicateEmail = (existingStaff || []).find(
        (item) => String(item.email || "").toLowerCase() === email,
      );
      const existingAccount =
        duplicateEmployee &&
        duplicateEmail &&
        duplicateEmployee.id === duplicateEmail.id
          ? duplicateEmployee
          : null;

      if ((duplicateEmployee || duplicateEmail) && !existingAccount) {
        return json({
          error: "The employee number or email is already used by another staff record.",
        }, 409);
      }

      if (existingAccount?.auth_user_id) {
        return json({ error: `A staff Auth account already exists for "${email}".` }, 409);
      }

      if (role === "Teacher") {
        const { data: classRecords, error: classError } = await adminClient
          .from("classes")
          .select("id, name")
          .eq("school_id", schoolId)
          .in("id", requestedClassIds);

        if (classError) throw classError;

        if ((classRecords || []).length !== requestedClassIds.length) {
          return json({ error: "One or more selected classes could not be found for this school." }, 400);
        }
      }

      const { data: authResult, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createAuthError || !authResult.user) {
        return json({ error: createAuthError?.message || "Unable to create Auth account." }, 400);
      }

      const authUserId = authResult.user.id;
      let staffRecord: Record<string, unknown> | null = null;
      let createdTeacher = false;

      try {
        if (existingAccount) {
          const { data, error: updateError } = await adminClient
            .from("teachers")
            .update({
              first_name: firstName,
              middle_name: middleName || null,
              last_name: lastName,
              email,
              role,
              status: "Active",
              auth_user_id: authUserId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAccount.id)
            .eq("school_id", schoolId)
            .select()
            .single();

          if (updateError) throw updateError;
          staffRecord = data;
        } else {
          const { data, error: insertError } = await adminClient
            .from("teachers")
            .insert({
              school_id: schoolId,
              employee_no: employeeNo,
              first_name: firstName,
              middle_name: middleName || null,
              last_name: lastName,
              email,
              role,
              status: "Active",
              auth_user_id: authUserId,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          staffRecord = data;
          createdTeacher = true;
        }

        if (!staffRecord) throw new Error("Staff record could not be saved.");

        if (role === "Teacher") {
          const { data: existingAssignments, error: existingAssignmentError } =
            await adminClient
              .from("teacher_class_assignments")
              .select("id, class_id")
              .eq("school_id", schoolId)
              .eq("teacher_id", staffRecord.id);

          if (existingAssignmentError) throw existingAssignmentError;

          const existingClassIds = new Set(
            (existingAssignments || []).map((item) => item.class_id),
          );
          const missingClassIds = requestedClassIds.filter(
            (classId) => !existingClassIds.has(classId),
          );

          if (missingClassIds.length > 0) {
            const { error: assignmentError } = await adminClient
              .from("teacher_class_assignments")
              .insert(
                missingClassIds.map((classId) => ({
                  teacher_id: staffRecord!.id,
                  class_id: classId,
                  school_id: schoolId,
                })),
              );

            if (assignmentError) throw assignmentError;
          }
        }

        const { data: savedAssignments, error: savedAssignmentError } =
          await adminClient
            .from("teacher_class_assignments")
            .select("class_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", staffRecord.id);

        if (savedAssignmentError) throw savedAssignmentError;

        const savedClassIds = (savedAssignments || []).map((item) => item.class_id);
        let savedClasses: Array<{ id: string; name: string }> = [];

        if (savedClassIds.length > 0) {
          const { data, error: savedClassesError } = await adminClient
            .from("classes")
            .select("id, name")
            .eq("school_id", schoolId)
            .in("id", savedClassIds);

          if (savedClassesError) throw savedClassesError;
          savedClasses = data || [];
        }

        return json({
          message: "Staff account created successfully. The Admin has authorized this account and it is ready for sign-in.",
          staff: {
            id: staffRecord.id,
            employeeNo: staffRecord.employee_no,
            firstName: staffRecord.first_name,
            middleName: staffRecord.middle_name,
            lastName: staffRecord.last_name,
            email: staffRecord.email,
            role: staffRecord.role,
            status: staffRecord.status,
            authUserId: staffRecord.auth_user_id,
            classIds: savedClassIds,
            classes: savedClasses,
            fullName: [staffRecord.first_name, staffRecord.middle_name, staffRecord.last_name]
              .filter(Boolean)
              .join(" "),
            hasAuthAccount: true,
          },
        }, 201);
      } catch (error) {
        if (createdTeacher && staffRecord?.id) {
          await adminClient
            .from("teacher_class_assignments")
            .delete()
            .eq("teacher_id", staffRecord.id)
            .eq("school_id", schoolId);

          await adminClient
            .from("teachers")
            .delete()
            .eq("id", staffRecord.id)
            .eq("school_id", schoolId);
        }

        await adminClient.auth.admin.deleteUser(authUserId);
        throw error;
      }
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("STAFF ACCOUNTS FUNCTION ERROR:", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to process staff account request.",
    }, 500);
  }
});
