const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env"
  );
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ======================================================
// CLASS ORDER
// ======================================================

const CLASS_ORDER = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message: "Predvic School Portal API is running",
    backend: "Supabase",
    status: "OK",
  });
});

// ======================================================
// TEST SUPABASE CONNECTION
// ======================================================

app.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("id, admission_no, first_name, last_name")
      .limit(10);

    if (error) {
      console.error("SUPABASE TEST ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
        details: error,
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      students: data || [],
    });
  } catch (error) {
    console.error("SUPABASE TEST ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ======================================================
// GET CLASSES
// ======================================================

app.get("/api/classes", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, display_order");

    if (error) {
      throw error;
    }

    const classes = [...(data || [])].sort(
      (a, b) => {
        const aIndex = CLASS_ORDER.indexOf(a.name);
        const bIndex = CLASS_ORDER.indexOf(b.name);

        return (
          (aIndex === -1 ? 999 : aIndex) -
          (bIndex === -1 ? 999 : bIndex)
        );
      }
    );

    res.json(classes);
  } catch (error) {
    console.error("GET CLASSES ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

// ======================================================
// GET STUDENTS
// ======================================================

app.get("/api/students", async (req, res) => {
  try {
    console.log(
      "========================================"
    );

    console.log(
      "GET /api/students"
    );

    console.log(
      "Querying Supabase students table..."
    );

    // IMPORTANT:
    // No status filter.
    // No class relationship.
    // No enrollment requirement.
    // Just get the students.

    const {
      data: students,
      error,
    } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        first_name,
        middle_name,
        last_name,
        gender,
        class_id,
        status,
        student_type,
        date_of_birth,
        parent_name,
        parent_phone,
        parent_email,
        address,
        admission_date,
        created_at,
        updated_at
      `)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "SUPABASE STUDENTS ERROR:"
      );

      console.error(error);

      return res.status(500).json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    console.log(
      `SUPABASE RETURNED ${
        students?.length || 0
      } STUDENTS`
    );

    // --------------------------------------------------
    // Get classes separately
    // --------------------------------------------------

    const {
      data: classes,
      error: classError,
    } = await supabase
      .from("classes")
      .select(
        "id, name, display_order"
      );

    if (classError) {
      console.error(
        "SUPABASE CLASSES ERROR:",
        classError
      );

      return res.status(500).json({
        error: classError.message,
      });
    }

    // --------------------------------------------------
    // Build class lookup
    // --------------------------------------------------

    const classMap = new Map();

    for (
      const classItem of classes || []
    ) {
      classMap.set(
        classItem.id,
        classItem.name
      );
    }

    // --------------------------------------------------
    // Format students for frontend
    // --------------------------------------------------

    const result =
      (students || []).map(
        (student) => {
          const className =
            classMap.get(
              student.class_id
            ) || "";

          const fullName = [
            student.first_name,
            student.middle_name,
            student.last_name,
          ]
            .filter(Boolean)
            .join(" ");

          return {
            id: student.id,

            studentId: student.id,

            firstName:
              student.first_name || "",

            middleName:
              student.middle_name || "",

            lastName:
              student.last_name || "",

            fullName,

            studentNumber:
              student.admission_no || "",

            admissionNo:
              student.admission_no || "",

            classId:
              student.class_id || null,

            className,

            gender:
              student.gender || "",

            status:
              student.status || "Active",

            studentType:
              student.student_type || "",

            dateOfBirth:
              student.date_of_birth || null,

            parentName:
              student.parent_name || "",

            parentPhone:
              student.parent_phone || "",

            parentEmail:
              student.parent_email || "",

            address:
              student.address || "",

            admissionDate:
              student.admission_date || null,

            createdAt:
              student.created_at || null,

            updatedAt:
              student.updated_at || null,
          };
        }
      );

    console.log(
      "FIRST STUDENT:"
    );

    console.log(
      result[0] || "NO STUDENTS"
    );

    console.log(
      "========================================"
    );

    res.json(result);
  } catch (error) {
    console.error(
      "GET STUDENTS ERROR:"
    );

    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

// ======================================================
// GET ONE STUDENT
// ======================================================

app.get(
  "/api/students/:id",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("students")
        .select(`
          id,
          admission_no,
          first_name,
          middle_name,
          last_name,
          gender,
          class_id,
          status,
          student_type,
          date_of_birth,
          parent_name,
          parent_phone,
          parent_email,
          address,
          admission_date,
          created_at,
          updated_at
        `)
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      res.json(data);
    } catch (error) {
      console.error(
        "GET ONE STUDENT ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// CREATE STUDENT
// ======================================================

app.post("/api/students", async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      gender,
      parentName,
      parentPhone,
      parentEmail,
      address,
      classId,
      className,
      studentType,
      admissionDate,
      dateOfBirth,
    } = req.body;

    if (!firstName?.trim()) {
      return res.status(400).json({
        error:
          "First name is required.",
      });
    }

    if (!lastName?.trim()) {
      return res.status(400).json({
        error:
          "Last name is required.",
      });
    }

    let selectedClassId =
      classId || null;

    // If frontend sends class name,
    // find its ID.
    if (
      !selectedClassId &&
      className
    ) {
      const {
        data: classRecord,
        error: classError,
      } = await supabase
        .from("classes")
        .select("id, name")
        .eq(
          "name",
          className
        )
        .maybeSingle();

      if (classError) {
        throw classError;
      }

      if (!classRecord) {
        return res.status(400).json({
          error:
            "Selected class does not exist.",
        });
      }

      selectedClassId =
        classRecord.id;
    }

    if (!selectedClassId) {
      return res.status(400).json({
        error:
          "A class is required.",
      });
    }

    // Generate admission number.
    const {
      count,
      error: countError,
    } = await supabase
      .from("students")
      .select("id", {
        count: "exact",
        head: true,
      });

    if (countError) {
      throw countError;
    }

    const nextNumber =
      Number(count || 0) + 1;

    const admissionNo =
      `ADM-${new Date().getFullYear()}-${String(
        nextNumber
      ).padStart(4, "0")}`;

    const {
      data: student,
      error,
    } = await supabase
      .from("students")
      .insert({
        admission_no:
          admissionNo,

        first_name:
          firstName.trim(),

        middle_name:
          middleName?.trim() || null,

        last_name:
          lastName.trim(),

        gender:
          gender || null,

        class_id:
          selectedClassId,

        status:
          "Active",

        student_type:
          studentType === "new"
            ? "new"
            : "returning",

        date_of_birth:
          dateOfBirth || null,

        parent_name:
          parentName?.trim() || null,

        parent_phone:
          parentPhone?.trim() || null,

        parent_email:
          parentEmail?.trim() || null,

        address:
          address?.trim() || null,

        admission_date:
          admissionDate ||
          new Date()
            .toISOString()
            .slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message:
        "Student created successfully.",

      student,
    });
  } catch (error) {
    console.error(
      "CREATE STUDENT ERROR:",
      error
    );

    res.status(500).json({
      error: error.message,
    });
  }
});

// ======================================================
// CURRENT ACADEMIC SESSION
// ======================================================

app.get(
  "/api/academic/current",
  async (req, res) => {
    try {
      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select(
          "id, name, is_active, starts_on, ends_on"
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        return res.status(404).json({
          error:
            "No active academic session.",
        });
      }

      const {
        data: term,
        error: termError,
      } = await supabase
        .from("terms")
        .select(`
          id,
          academic_session_id,
          name,
          starts_on,
          ends_on,
          status
        `)
        .eq(
          "academic_session_id",
          session.id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

      if (termError) {
        throw termError;
      }

      res.json({
        session,
        term: term || null,
      });
    } catch (error) {
      console.error(
        "ACADEMIC ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// GET ATTENDANCE
// ======================================================

app.get(
  "/api/attendance",
  async (req, res) => {
    try {
      let query =
        supabase
          .from(
            "student_attendance"
          )
          .select(`
            id,
            student_id,
            enrollment_id,
            attendance_date,
            status,
            note,
            created_at
          `)
          .order(
            "attendance_date",
            {
              ascending: true,
            }
          );

      if (req.query.date) {
        query =
          query.eq(
            "attendance_date",
            req.query.date
          );
      }

      if (
        req.query.startDate
      ) {
        query =
          query.gte(
            "attendance_date",
            req.query.startDate
          );
      }

      if (
        req.query.endDate
      ) {
        query =
          query.lte(
            "attendance_date",
            req.query.endDate
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      res.json(
        data || []
      );
    } catch (error) {
      console.error(
        "GET ATTENDANCE ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// SAVE ATTENDANCE
// ======================================================

app.post(
  "/api/attendance",
  async (req, res) => {
    try {
      const {
        date,
        attendance,
      } = req.body;

      if (!date) {
        return res.status(400).json({
          error:
            "Attendance date is required.",
        });
      }

      if (
        !attendance ||
        typeof attendance !==
          "object"
      ) {
        return res.status(400).json({
          error:
            "Attendance data is required.",
        });
      }

      const records =
        Object.entries(
          attendance
        ).map(
          ([
            studentId,
            status,
          ]) => ({
            student_id:
              studentId,

            attendance_date:
              date,

            status,
          })
        );

      const {
        data,
        error,
      } = await supabase
        .from(
          "student_attendance"
        )
        .upsert(
          records,
          {
            onConflict:
              "student_id,attendance_date",
          }
        )
        .select();

      if (error) {
        throw error;
      }

      res.status(201).json({
        message:
          "Attendance saved successfully.",

        records:
          data || [],
      });
    } catch (error) {
      console.error(
        "SAVE ATTENDANCE ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// FEE ACCOUNTS
// ======================================================

app.get(
  "/api/fee-accounts",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "fee_accounts"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      res.json(
        data || []
      );
    } catch (error) {
      console.error(
        "FEE ACCOUNTS ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "PREDVIC SCHOOL PORTAL BACKEND"
    );
    console.log(
      "========================================"
    );
    console.log(
      `Server: http://localhost:${PORT}`
    );
    console.log(
      "Database: Supabase"
    );
    console.log(
      "Airtable: DISCONNECTED"
    );
    console.log(
      "========================================"
    );
    console.log("");
  }
);