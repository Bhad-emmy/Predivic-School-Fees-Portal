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
