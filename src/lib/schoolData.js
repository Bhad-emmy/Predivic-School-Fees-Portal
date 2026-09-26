import { supabase } from "./supabase";

const STUDENT_FIELDS = [
  "id",
  "admission_no",
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "status",
  "student_type",
  "date_of_birth",
  "parent_name",
  "parent_relationship",
  "parent_phone",
  "parent_email",
  "address",
  "admission_date",
  "age",
  "place_of_birth",
  "nationality",
  "state_of_origin",
  "hometown",
  "lga",
  "religion",
  "denomination",
  "secondary_parent_name",
  "secondary_parent_phone",
  "emergency_contact_name",
  "emergency_contact_phone",
  "previous_school",
  "medical_information",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

const toStudent = (student, enrollment, classMap) => ({
  id: student.id,
  admissionNo: student.admission_no || "",
  firstName: student.first_name || "",
  middleName: student.middle_name || "",
  lastName: student.last_name || "",
  fullName: [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" "),
  gender: student.gender || "",
  classId: enrollment?.class_id || null,
  className: classMap.get(enrollment?.class_id) || "",
  enrollmentId: enrollment?.id || null,
  enrollmentStatus: enrollment?.status || null,
  sessionId: enrollment?.session_id || null,
  termId: enrollment?.term_id || null,
  status: student.status || "Active",
  studentType: student.student_type || "returning",
  dateOfBirth: student.date_of_birth || null,
  admissionDate: student.admission_date || null,
  parentName: student.parent_name || "",
  parentRelationship: student.parent_relationship || "",
  parentPhone: student.parent_phone || "",
  parentEmail: student.parent_email || "",
  address: student.address || "",
  age: student.age ?? "",
  placeOfBirth: student.place_of_birth || "",
  nationality: student.nationality || "",
  stateOfOrigin: student.state_of_origin || "",
  hometown: student.hometown || "",
  lga: student.lga || "",
  religion: student.religion || "",
  denomination: student.denomination || "",
  secondaryParentName: student.secondary_parent_name || "",
  secondaryParentPhone: student.secondary_parent_phone || "",
  emergencyContactName: student.emergency_contact_name || "",
  emergencyContactPhone: student.emergency_contact_phone || "",
  previousSchool: student.previous_school || "",
  medicalInformation: student.medical_information || "",
  notes: student.notes || "",
  createdAt: student.created_at || null,
  updatedAt: student.updated_at || null,
});

export async function getClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, display_order")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getStudents() {
  const [{ data: students, error: studentsError }, { data: session, error: sessionError }] =
    await Promise.all([
      supabase.from("students").select(STUDENT_FIELDS).order("created_at", { ascending: true }),
      supabase.from("academic_sessions").select("id").eq("is_active", true).maybeSingle(),
    ]);

  if (studentsError) throw studentsError;
  if (sessionError) throw sessionError;

  const [{ data: classes, error: classesError }, enrollmentResult] = await Promise.all([
    supabase.from("classes").select("id, name, display_order").order("display_order", { ascending: true }),
    session
      ? supabase
          .from("student_enrollments")
          .select("id, student_id, session_id, term_id, class_id, status")
          .eq("session_id", session.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (classesError) throw classesError;
  if (enrollmentResult.error) throw enrollmentResult.error;

  const classMap = new Map((classes || []).map((item) => [item.id, item.name]));
  const enrollmentMap = new Map(
    (enrollmentResult.data || []).map((item) => [item.student_id, item])
  );

  return (students || []).map((student) =>
    toStudent(student, enrollmentMap.get(student.id), classMap)
  );
}

export async function getStudentFeeAccounts() {
  const { data: accounts, error } = await supabase
    .from("student_fee_accounts")
    .select("id, student_id, enrollment_id, fee_account_id, total_amount, status, notes, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!accounts?.length) return [];

  const studentIds = [...new Set(accounts.map((a) => a.student_id).filter(Boolean))];
  const feeAccountIds = [...new Set(accounts.map((a) => a.fee_account_id).filter(Boolean))];

  const [studentsResult, feeStructuresResult] = await Promise.all([
    supabase.from("students")
      .select("id, admission_no, first_name, middle_name, last_name, student_type, status")
      .in("id", studentIds),
    feeAccountIds.length
      ? supabase.from("fee_accounts")
          .select("id, class_id, academic_session_id, term_id, student_type, department, total_amount, is_active")
          .in("id", feeAccountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (feeStructuresResult.error) throw feeStructuresResult.error;

  const structures = feeStructuresResult.data || [];
  const classIds = [...new Set(structures.map((x) => x.class_id).filter(Boolean))];
  const sessionIds = [...new Set(structures.map((x) => x.academic_session_id).filter(Boolean))];
  const termIds = [...new Set(structures.map((x) => x.term_id).filter(Boolean))];
  const accountIds = accounts.map((x) => x.id);

  const [classesResult, sessionsResult, termsResult, paymentsResult] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, name").in("id", sessionIds) : Promise.resolve({ data: [], error: null }),
    termIds.length ? supabase.from("terms").select("id, name").in("id", termIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("payments").select("id, student_fee_account_id, amount, status").in("student_fee_account_id", accountIds),
  ]);

  for (const result of [classesResult, sessionsResult, termsResult, paymentsResult]) {
    if (result.error) throw result.error;
  }

  const studentMap = new Map((studentsResult.data || []).map((x) => [x.id, x]));
  const structureMap = new Map(structures.map((x) => [x.id, x]));
  const classMap = new Map((classesResult.data || []).map((x) => [x.id, x.name]));
  const sessionMap = new Map((sessionsResult.data || []).map((x) => [x.id, x.name]));
  const termMap = new Map((termsResult.data || []).map((x) => [x.id, x.name]));
  const paidMap = new Map();

  for (const payment of paymentsResult.data || []) {
    const status = String(payment.status || "").toLowerCase();
    if (status && !["paid", "successful", "completed"].includes(status)) continue;
    paidMap.set(
      payment.student_fee_account_id,
      (paidMap.get(payment.student_fee_account_id) || 0) + Number(payment.amount || 0)
    );
  }

  return accounts.map((account) => {
    const student = studentMap.get(account.student_id);
    const structure = structureMap.get(account.fee_account_id);
    const totalAmount = Number(account.total_amount ?? structure?.total_amount ?? 0);
    const totalPaid = Number(paidMap.get(account.id) || 0);
    const balance = Math.max(totalAmount - totalPaid, 0);

    return {
      id: account.id,
      studentId: account.student_id,
      enrollmentId: account.enrollment_id,
      feeAccountId: account.fee_account_id,
      student: student
        ? {
            id: student.id,
            admissionNo: student.admission_no || "",
            firstName: student.first_name || "",
            middleName: student.middle_name || "",
            lastName: student.last_name || "",
            fullName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
            studentType: student.student_type || "",
            status: student.status || "",
          }
        : null,
      classId: structure?.class_id || null,
      className: structure ? classMap.get(structure.class_id) || "Unknown Class" : "Unknown Class",
      academicSessionId: structure?.academic_session_id || null,
      session: structure ? sessionMap.get(structure.academic_session_id) || "Unknown Session" : "Unknown Session",
      termId: structure?.term_id || null,
      term: structure ? termMap.get(structure.term_id) || "Unknown Term" : "Unknown Term",
      studentType: structure?.student_type || student?.student_type || "",
      department: structure?.department || null,
      totalAmount,
      totalPaid,
      balance,
      status: balance <= 0 ? "Paid" : totalPaid > 0 ? "Part Payment" : "Unpaid",
      notes: account.notes || "",
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    };
  });
}

export async function getPayments() {
  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, student_id, student_fee_account_id, fee_account_id, amount, payment_date, method, reference, status, notes, created_at")
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!payments?.length) return [];

  const studentIds = [...new Set(payments.map((p) => p.student_id).filter(Boolean))];
  const studentFeeAccountIds = [...new Set(payments.map((p) => p.student_fee_account_id).filter(Boolean))];
  const paymentIds = payments.map((p) => p.id);

  const [studentsResult, accountsResult, receiptsResult] = await Promise.all([
    supabase.from("students").select("id, admission_no, first_name, middle_name, last_name").in("id", studentIds),
    studentFeeAccountIds.length
      ? supabase.from("student_fee_accounts").select("id, fee_account_id, total_amount").in("id", studentFeeAccountIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("receipts").select("payment_id, receipt_number, issued_at").in("payment_id", paymentIds),
  ]);

  for (const result of [studentsResult, accountsResult, receiptsResult]) {
    if (result.error) throw result.error;
  }

  const feeAccountIds = [...new Set((accountsResult.data || []).map((a) => a.fee_account_id).filter(Boolean))];
  const feeResult = feeAccountIds.length
    ? await supabase.from("fee_accounts").select("id, class_id").in("id", feeAccountIds)
    : { data: [], error: null };
  if (feeResult.error) throw feeResult.error;

  const classIds = [...new Set((feeResult.data || []).map((a) => a.class_id).filter(Boolean))];
  const classResult = classIds.length
    ? await supabase.from("classes").select("id, name").in("id", classIds)
    : { data: [], error: null };
  if (classResult.error) throw classResult.error;

  const studentMap = new Map((studentsResult.data || []).map((x) => [x.id, x]));
  const accountMap = new Map((accountsResult.data || []).map((x) => [x.id, x]));
  const feeMap = new Map((feeResult.data || []).map((x) => [x.id, x]));
  const classMap = new Map((classResult.data || []).map((x) => [x.id, x.name]));
  const receiptMap = new Map((receiptsResult.data || []).map((x) => [x.payment_id, x]));

  return payments.map((payment) => {
    const student = studentMap.get(payment.student_id);
    const feeAccount = feeMap.get(accountMap.get(payment.student_fee_account_id)?.fee_account_id);
    const receipt = receiptMap.get(payment.id);
    return {
      id: payment.id,
      studentId: payment.student_id,
      studentFeeAccountId: payment.student_fee_account_id,
      studentName: student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") : "Unknown Student",
      admissionNo: student?.admission_no || "",
      className: classMap.get(feeAccount?.class_id) || "Unknown Class",
      amount: Number(payment.amount),
      method: payment.method || "",
      paymentDate: payment.payment_date,
      status: ["paid", "successful", "completed"].includes(String(payment.status || "").toLowerCase()) ? "Paid" : payment.status || "Unknown",
      notes: payment.notes || "",
      reference: payment.reference || "",
      receiptNumber: receipt?.receipt_number || null,
      receiptIssuedAt: receipt?.issued_at || null,
    };
  });
}



async function resolveFeeStructureRefs({ session, term, className }) {
  const normalizedTerm = String(term || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  const { data: sessionRecord, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id, name, school_id")
    .eq("name", session)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!sessionRecord) throw new Error(`Academic session "${session}" was not found.`);

  const { data: classRecord, error: classError } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("name", className)
    .maybeSingle();

  if (classError) throw classError;
  if (!classRecord) throw new Error(`Class "${className}" was not found.`);

  const { data: terms, error: termError } = await supabase
    .from("terms")
    .select("id, name, academic_session_id, school_id");

  if (termError) throw termError;

  const termRecord = (terms || []).find((item) => {
    const value = String(item.name || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    const normalized = value === "1stterm" ? "1stterm"
      : value === "firstterm" ? "firstterm"
      : value === "2ndterm" ? "2ndterm"
      : value === "secondterm" ? "secondterm"
      : value === "3rdterm" ? "3rdterm"
      : value === "thirdterm" ? "thirdterm"
      : value;
    return normalized === normalizedTerm ||
      (normalizedTerm === "firstterm" && normalized === "1stterm") ||
      (normalizedTerm === "secondterm" && normalized === "2ndterm") ||
      (normalizedTerm === "thirdterm" && normalized === "3rdterm");
  });

  if (!termRecord) throw new Error(`Term "${term}" was not found.`);
  if (termRecord.academic_session_id !== sessionRecord.id) {
    throw new Error("The selected term does not belong to the selected academic session.");
  }

  const schoolId = classRecord.school_id || sessionRecord.school_id || termRecord.school_id || null;
  if (!schoolId) throw new Error("Unable to determine the school for this fee structure.");

  return { sessionRecord, classRecord, termRecord, schoolId };
}

function normalizeFeeDepartment(className, department) {
  const senior = className === "SS 2" || className === "SS 3";
  const value = department ? String(department).trim() : "";
  if (senior && !["Art", "Science", "Commercial"].includes(value)) {
    throw new Error("Department is required for SS2/SS3 and must be Art, Science, or Commercial.");
  }
  if (!senior && value) {
    throw new Error("Department should only be selected for SS2/SS3.");
  }
  return senior ? value : null;
}

function cleanFeeItemsForWrite(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      amount: Number(item?.amount || 0),
    }))
    .filter((item) => item.name && item.amount > 0);

  if (!cleaned.length) throw new Error("Add at least one valid fee item.");
  return cleaned.map((item, index) => ({ ...item, sort_order: index }));
}

export async function createFeeStructure({
  session,
  term,
  className,
  department,
  studentType,
  feeItems,
}) {
  if (!session || !term || !className || !studentType) {
    throw new Error("Session, term, class and student type are required.");
  }

  const items = cleanFeeItemsForWrite(feeItems);
  const normalizedDepartment = normalizeFeeDepartment(className, department);
  const { sessionRecord, classRecord, termRecord, schoolId } =
    await resolveFeeStructureRefs({ session, term, className });

  const { data: duplicate, error: duplicateError } = await supabase
    .from("fee_accounts")
    .select("id, department")
    .eq("school_id", schoolId)
    .eq("class_id", classRecord.id)
    .eq("academic_session_id", sessionRecord.id)
    .eq("term_id", termRecord.id)
    .eq("student_type", studentType);

  if (duplicateError) throw duplicateError;
  if ((duplicate || []).some((row) => (row.department || null) === normalizedDepartment)) {
    throw new Error("A fee structure already exists for this class, session, term, student type and department.");
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const { data: feeAccount, error: accountError } = await supabase
    .from("fee_accounts")
    .insert({
      school_id: schoolId,
      class_id: classRecord.id,
      academic_session_id: sessionRecord.id,
      term_id: termRecord.id,
      student_type: studentType,
      department: normalizedDepartment,
      total_amount: totalAmount,
      notes: null,
      is_active: true,
    })
    .select()
    .single();

  if (accountError) throw accountError;

  const { error: itemError } = await supabase.from("fee_items").insert(
    items.map((item) => ({
      fee_account_id: feeAccount.id,
      name: item.name,
      amount: item.amount,
      sort_order: item.sort_order,
    }))
  );

  if (itemError) {
    await supabase.from("fee_accounts").delete().eq("id", feeAccount.id);
    throw itemError;
  }

  return feeAccount;
}

export async function updateFeeStructure({
  id,
  session,
  term,
  className,
  department,
  studentType,
  feeItems,
}) {
  if (!id) throw new Error("Fee structure ID is required.");
  if (!session || !term || !className || !studentType) {
    throw new Error("Session, term, class and student type are required.");
  }

  const items = cleanFeeItemsForWrite(feeItems);
  const normalizedDepartment = normalizeFeeDepartment(className, department);
  const { sessionRecord, classRecord, termRecord } =
    await resolveFeeStructureRefs({ session, term, className });

  const { data: existing, error: existingError } = await supabase
    .from("fee_accounts")
    .select("id, school_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error("Fee structure not found.");

  const { data: duplicates, error: duplicateError } = await supabase
    .from("fee_accounts")
    .select("id, department")
    .eq("school_id", existing.school_id)
    .eq("class_id", classRecord.id)
    .eq("academic_session_id", sessionRecord.id)
    .eq("term_id", termRecord.id)
    .eq("student_type", studentType)
    .neq("id", id);

  if (duplicateError) throw duplicateError;
  if ((duplicates || []).some((row) => (row.department || null) === normalizedDepartment)) {
    throw new Error("A fee structure already exists for this class, session, term, student type and department.");
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const { error: updateError } = await supabase
    .from("fee_accounts")
    .update({
      class_id: classRecord.id,
      academic_session_id: sessionRecord.id,
      term_id: termRecord.id,
      student_type: studentType,
      department: normalizedDepartment,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) throw updateError;

  const { error: deleteItemsError } = await supabase
    .from("fee_items")
    .delete()
    .eq("fee_account_id", id);

  if (deleteItemsError) throw deleteItemsError;

  const { error: insertItemsError } = await supabase.from("fee_items").insert(
    items.map((item) => ({
      fee_account_id: id,
      name: item.name,
      amount: item.amount,
      sort_order: item.sort_order,
    }))
  );

  if (insertItemsError) throw insertItemsError;
}

export async function deleteFeeStructure(id) {
  if (!id) throw new Error("Fee structure ID is required.");

  const { count, error: assignmentError } = await supabase
    .from("student_fee_accounts")
    .select("id", { count: "exact", head: true })
    .eq("fee_account_id", id);

  if (assignmentError) throw assignmentError;
  if ((count || 0) > 0) {
    throw new Error("This fee structure has already been assigned to students and cannot be deleted.");
  }

  const { data: existing, error: findError } = await supabase
    .from("fee_accounts")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findError) throw findError;
  if (!existing) throw new Error("Fee structure not found.");

  const { error: itemError } = await supabase.from("fee_items").delete().eq("fee_account_id", id);
  if (itemError) throw itemError;

  const { error: accountError } = await supabase.from("fee_accounts").delete().eq("id", id);
  if (accountError) throw accountError;
}

export async function assignFeeStructure({
  studentId,
  feeAccountId,
  notes,
}) {
  if (!studentId) throw new Error("Student is required.");
  if (!feeAccountId) throw new Error("Fee structure is required.");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new Error("Student not found.");

  const { data: feeStructure, error: feeError } = await supabase
    .from("fee_accounts")
    .select("id, school_id, class_id, academic_session_id, total_amount, is_active")
    .eq("id", feeAccountId)
    .maybeSingle();

  if (feeError) throw feeError;
  if (!feeStructure) throw new Error("Fee structure not found.");
  if (!feeStructure.is_active) throw new Error("This fee structure is inactive.");

  const { data: existing, error: existingError } = await supabase
    .from("student_fee_accounts")
    .select("id")
    .eq("student_id", studentId)
    .eq("fee_account_id", feeAccountId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) throw new Error("This fee structure is already assigned to the student.");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .select("id, student_id, session_id, class_id, status")
    .eq("student_id", studentId)
    .eq("session_id", feeStructure.academic_session_id)
    .eq("class_id", feeStructure.class_id)
    .eq("status", "active")
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) {
    throw new Error("No active enrollment matches this student's fee structure.");
  }

  const { data, error } = await supabase
    .from("student_fee_accounts")
    .insert({
      school_id: feeStructure.school_id || student.school_id,
      student_id: studentId,
      enrollment_id: enrollment.id,
      fee_account_id: feeAccountId,
      total_amount: Number(feeStructure.total_amount) || 0,
      status: "outstanding",
      notes: String(notes || "").trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFeeStructures() {
  const { data: feeAccounts, error } = await supabase
    .from("fee_accounts")
    .select("id, class_id, academic_session_id, term_id, student_type, department, total_amount, notes, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!feeAccounts?.length) return [];

  const feeAccountIds = feeAccounts.map((item) => item.id);
  const classIds = [...new Set(feeAccounts.map((item) => item.class_id).filter(Boolean))];
  const sessionIds = [...new Set(feeAccounts.map((item) => item.academic_session_id).filter(Boolean))];
  const termIds = [...new Set(feeAccounts.map((item) => item.term_id).filter(Boolean))];

  const [itemsResult, classesResult, sessionsResult, termsResult] = await Promise.all([
    supabase.from("fee_items").select("id, fee_account_id, name, amount, sort_order").in("fee_account_id", feeAccountIds).order("sort_order", { ascending: true }),
    supabase.from("classes").select("id, name").in("id", classIds),
    supabase.from("academic_sessions").select("id, name").in("id", sessionIds),
    supabase.from("terms").select("id, name").in("id", termIds),
  ]);

  for (const result of [itemsResult, classesResult, sessionsResult, termsResult]) {
    if (result.error) throw result.error;
  }

  const classMap = new Map((classesResult.data || []).map((x) => [x.id, x.name]));
  const sessionMap = new Map((sessionsResult.data || []).map((x) => [x.id, x.name]));
  const termMap = new Map((termsResult.data || []).map((x) => [x.id, x.name]));
  const itemsMap = new Map();

  for (const item of itemsResult.data || []) {
    if (!itemsMap.has(item.fee_account_id)) itemsMap.set(item.fee_account_id, []);
    itemsMap.get(item.fee_account_id).push({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      sortOrder: item.sort_order,
    });
  }

  return feeAccounts.map((account) => ({
    id: account.id,
    classId: account.class_id,
    className: classMap.get(account.class_id) || "Unknown Class",
    academicSessionId: account.academic_session_id,
    session: sessionMap.get(account.academic_session_id) || "",
    termId: account.term_id,
    term: termMap.get(account.term_id) || "",
    studentType: account.student_type,
    department: account.department || null,
    total: Number(account.total_amount || 0),
    notes: account.notes || "",
    isActive: account.is_active,
    feeItems: itemsMap.get(account.id) || [],
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  }));
}

export async function recordPayment({
  studentId,
  studentFeeAccountId,
  amount,
  method,
  paymentDate,
  notes,
  reference,
}) {
  const { data, error } = await supabase.rpc("record_payment", {
    p_amount: Number(amount),
    p_method: String(method || "").trim(),
    p_notes: notes || null,
    p_payment_date: paymentDate || null,
    p_reference: reference || null,
    p_student_fee_account_id: studentFeeAccountId,
    p_student_id: studentId,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    paymentId: result.payment_id,
    receiptNumber: result.receipt_number,
    totalPaid: Number(result.total_paid),
    balance: Number(result.balance),
    status: Number(result.balance) <= 0 ? "Paid" : Number(result.total_paid) > 0 ? "Part Payment" : "Unpaid",
  };
}



export async function createNewStudent(form) {
  if (!form?.firstName?.trim()) throw new Error("First name is required.");
  if (!form?.lastName?.trim()) throw new Error("Last name is required.");
  if (!form?.gender) throw new Error("Gender is required.");
  if (!form?.classId) throw new Error("Class is required.");

  const { data: classRecord, error: classError } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("id", form.classId)
    .maybeSingle();

  if (classError) throw classError;
  if (!classRecord) throw new Error("Selected class was not found.");

  const className = String(classRecord.name || "").trim().toUpperCase();
  const isSeniorSecondary = className === "SS 2" || className === "SS 3";
  const department = form.department ? String(form.department).trim() : null;

  if (isSeniorSecondary && !department) {
    throw new Error("Department is required for SS2/SS3 students.");
  }

  if (!isSeniorSecondary && department) {
    throw new Error("Department should only be selected for SS2/SS3 students.");
  }

  if (isSeniorSecondary && !["Science", "Commercial", "Art"].includes(department)) {
    throw new Error("Invalid department. Choose Science, Commercial, or Art.");
  }

  const { data: session, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id, name, school_id")
    .eq("is_active", true)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("No active academic session exists.");

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("id, name, academic_session_id, status, school_id")
    .eq("academic_session_id", session.id)
    .eq("status", "active")
    .maybeSingle();

  if (termError) throw termError;
  if (!term) throw new Error("No active term exists for the current academic session.");

  const schoolId = classRecord.school_id || session.school_id || term.school_id || null;
  if (!schoolId) throw new Error("Unable to determine the school for this registration.");

  let feeQuery = supabase
    .from("fee_accounts")
    .select("id, total_amount, student_type, department")
    .eq("school_id", schoolId)
    .eq("class_id", form.classId)
    .eq("academic_session_id", session.id)
    .eq("term_id", term.id)
    .eq("student_type", "new")
    .eq("is_active", true);

  feeQuery = isSeniorSecondary
    ? feeQuery.eq("department", department)
    : feeQuery.is("department", null);

  const { data: feeStructure, error: feeStructureError } = await feeQuery.maybeSingle();
  if (feeStructureError) throw feeStructureError;

  if (!feeStructure) {
    throw new Error(
      isSeniorSecondary
        ? `No active fee structure exists for ${classRecord.name} - new - ${department}.`
        : `No active fee structure exists for ${classRecord.name} - new.`
    );
  }

  const admissionNo = form.admissionNo?.trim() || null;

  if (admissionNo) {
    const { data: existingAdmission, error: admissionCheckError } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("admission_no", admissionNo)
      .maybeSingle();

    if (admissionCheckError) throw admissionCheckError;
    if (existingAdmission) throw new Error("Admission number already exists.");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      admission_no: admissionNo,
      first_name: form.firstName.trim(),
      middle_name: form.middleName?.trim() || null,
      last_name: form.lastName.trim(),
      gender: form.gender,
      status: "Active",
      student_type: "new",
      department: isSeniorSecondary ? department : null,
      date_of_birth: form.dateOfBirth || null,
      parent_name: form.parentName?.trim() || null,
      parent_relationship: form.parentRelationship?.trim() || null,
      parent_phone: form.parentPhone?.trim() || null,
      parent_email: form.parentEmail?.trim() || null,
      address: form.address?.trim() || null,
      admission_date: form.admissionDate || null,
      age: form.age === "" || form.age === undefined ? null : Number(form.age),
      place_of_birth: form.placeOfBirth?.trim() || null,
      nationality: form.nationality?.trim() || null,
      state_of_origin: form.stateOfOrigin?.trim() || null,
      hometown: form.hometown?.trim() || null,
      lga: form.lga?.trim() || null,
      religion: form.religion?.trim() || null,
      denomination: form.denomination?.trim() || null,
      secondary_parent_name: form.secondaryParentName?.trim() || null,
      secondary_parent_phone: form.secondaryParentPhone?.trim() || null,
      emergency_contact_name: form.emergencyContactName?.trim() || null,
      emergency_contact_phone: form.emergencyContactPhone?.trim() || null,
      previous_school: form.previousSchool?.trim() || null,
      medical_information: form.medicalInformation?.trim() || null,
      notes: form.notes?.trim() || null,
    })
    .select()
    .single();

  if (studentError) throw studentError;

  let enrollment = null;
  let studentFeeAccount = null;
  let guardian = null;
  let admission = null;

  try {
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .insert({
        school_id: schoolId,
        student_id: student.id,
        session_id: session.id,
        term_id: term.id,
        class_id: form.classId,
        status: "active",
      })
      .select()
      .single();

    if (enrollmentError) throw enrollmentError;
    enrollment = enrollmentData;

    const { data: feeAccountData, error: feeAccountError } = await supabase
      .from("student_fee_accounts")
      .insert({
        school_id: schoolId,
        student_id: student.id,
        enrollment_id: enrollment.id,
        fee_account_id: feeStructure.id,
        total_amount: Number(feeStructure.total_amount) || 0,
        status: "outstanding",
      })
      .select()
      .single();

    if (feeAccountError) throw feeAccountError;
    studentFeeAccount = feeAccountData;

    const guardianForm = form.guardian || {};
    const hasGuardian = Object.values(guardianForm).some(
      (value) => value !== null && value !== undefined && String(value).trim() !== ""
    );

    if (hasGuardian) {
      const { data: guardianData, error: guardianError } = await supabase
        .from("guardians")
        .insert({
          school_id: schoolId,
          student_id: student.id,
          full_name: guardianForm.fullName?.trim() || null,
          relationship: guardianForm.relationship?.trim() || null,
          residential_address: guardianForm.residentialAddress?.trim() || null,
          contact_address: guardianForm.contactAddress?.trim() || null,
          nationality: guardianForm.nationality?.trim() || null,
          state: guardianForm.state?.trim() || null,
          occupation: guardianForm.occupation?.trim() || null,
          religion: guardianForm.religion?.trim() || null,
          denomination: guardianForm.denomination?.trim() || null,
          date_of_birth: guardianForm.dateOfBirth || null,
          marriage_anniversary: guardianForm.marriageAnniversary || null,
          medical_declaration: guardianForm.medicalDeclaration?.trim() || null,
          is_primary: true,
        })
        .select()
        .single();

      if (guardianError) throw guardianError;
      guardian = guardianData;
    }

    const admissionForm = form.admission || {};
    const hasAdmission = Object.values(admissionForm).some(
      (value) => value !== null && value !== undefined && String(value).trim() !== ""
    );

    if (hasAdmission) {
      const { data: admissionData, error: admissionError } = await supabase
        .from("admissions")
        .insert({
          school_id: schoolId,
          student_id: student.id,
          admission_status: admissionForm.admissionStatus || "Pending",
          parent_declaration: admissionForm.parentDeclaration?.trim() || null,
          parent_signature_name: admissionForm.parentSignatureName?.trim() || null,
          declaration_date: admissionForm.declarationDate || null,
          school_authorized_by: admissionForm.schoolAuthorizedBy?.trim() || null,
          school_signature_name: admissionForm.schoolSignatureName?.trim() || null,
        })
        .select()
        .single();

      if (admissionError) throw admissionError;
      admission = admissionData;
    }
  } catch (error) {
    if (admission?.id) {
      await supabase.from("admissions").delete().eq("id", admission.id);
    }
    if (guardian?.id) {
      await supabase.from("guardians").delete().eq("id", guardian.id);
    }
    if (studentFeeAccount?.id) {
      await supabase.from("student_fee_accounts").delete().eq("id", studentFeeAccount.id);
    }
    if (enrollment?.id) {
      await supabase.from("student_enrollments").delete().eq("id", enrollment.id);
    }
    await supabase.from("students").delete().eq("id", student.id);
    throw error;
  }

  return {
    message: "Student created successfully.",
    student,
    studentFeeAccount,
    feeAllocation: {
      feeAccountId: feeStructure.id,
      amount: Number(feeStructure.total_amount) || 0,
      studentType: "new",
      department,
    },
    guardian,
    admission,
  };
}

export async function searchReturningStudents({ admissionNo, firstName, lastName, dateOfBirth, parentPhone }) {
  if (!admissionNo && !firstName && !lastName && !dateOfBirth && !parentPhone) throw new Error("Enter at least one search field.");
  let query = supabase.from("students").select("id, admission_no, first_name, middle_name, last_name, gender, date_of_birth, parent_name, parent_relationship, parent_phone, parent_email, address, status, student_type").eq("status", "Active").limit(20);
  if (admissionNo?.trim()) query = query.eq("admission_no", admissionNo.trim());
  else {
    if (firstName?.trim()) query = query.ilike("first_name", `%${firstName.trim()}%`);
    if (lastName?.trim()) query = query.ilike("last_name", `%${lastName.trim()}%`);
    if (dateOfBirth) query = query.eq("date_of_birth", dateOfBirth);
    if (parentPhone?.trim()) query = query.ilike("parent_phone", `%${parentPhone.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}


export async function registerReturningStudent({ studentId, classId }) {
  if (!studentId) throw new Error("Student ID is required.");
  if (!classId) throw new Error("Class is required.");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, admission_no, first_name, middle_name, last_name, status, school_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new Error("Existing student was not found.");
  if (String(student.status || "").toLowerCase() !== "active") {
    throw new Error("This student is not active.");
  }

  const { data: classRecord, error: classError } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) throw classError;
  if (!classRecord) throw new Error("Selected class was not found.");

  const { data: session, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id, name, is_active, school_id")
    .eq("is_active", true)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("No active academic session exists.");

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("id, name, academic_session_id, status, school_id")
    .eq("academic_session_id", session.id)
    .eq("status", "active")
    .maybeSingle();

  if (termError) throw termError;
  if (!term) throw new Error("No active term exists for the current academic session.");

  const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
    .from("student_enrollments")
    .select("id, student_id, session_id, term_id, class_id, status")
    .eq("student_id", studentId)
    .eq("session_id", session.id)
    .maybeSingle();

  if (enrollmentCheckError) throw enrollmentCheckError;

  if (existingEnrollment) {
    const error = new Error("This student is already enrolled for the current academic session.");
    error.code = "ALREADY_ENROLLED";
    error.enrollment = existingEnrollment;
    throw error;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .insert({
      student_id: studentId,
      session_id: session.id,
      term_id: term.id,
      class_id: classId,
      status: "active",
      school_id: student.school_id || classRecord.school_id || session.school_id || term.school_id || null,
    })
    .select()
    .single();

  if (enrollmentError) throw enrollmentError;

  const { error: updateStudentError } = await supabase
    .from("students")
    .update({ student_type: "returning" })
    .eq("id", studentId);

  if (updateStudentError) {
    console.error("UPDATE STUDENT TYPE ERROR:", updateStudentError);
  }

  return {
    message: "Returning student registered successfully.",
    student: {
      id: student.id,
      admissionNo: student.admission_no,
      fullName: [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(" "),
    },
    enrollment: {
      id: enrollment.id,
      studentId: enrollment.student_id,
      sessionId: enrollment.session_id,
      termId: enrollment.term_id,
      classId: enrollment.class_id,
      className: classRecord.name,
      sessionName: session.name,
      termName: term.name,
      status: enrollment.status,
    },
  };
}
