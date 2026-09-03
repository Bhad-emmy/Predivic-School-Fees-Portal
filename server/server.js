const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
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
  "KG 1",
  "KG 2",
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
// HELPER FUNCTIONS
// ======================================================

function normalizeTerm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("first", "1st")
    .replace("second", "2nd")
    .replace("third", "3rd");
}

function isDepartmentClass(className) {
  return (
    className === "SS 2" ||
    className === "SS 3"
  );
}

function validateDepartment(
  className,
  department
) {
  const requiresDepartment =
    isDepartmentClass(className);

  if (requiresDepartment) {
    if (
      department !== "Art" &&
      department !== "Science" &&
      department !== "Commercial"
    ) {
      return {
        valid: false,
        department: null,
        error:
          "SS2 and SS3 require a department: Art, Science, or Commercial.",
      };
    }

    return {
      valid: true,
      department,
      error: null,
    };
  }

  if (
    department !== null &&
    department !== undefined &&
    department !== ""
  ) {
    return {
      valid: false,
      department: null,
      error:
        "Department is only allowed for SS2 and SS3.",
    };
  }

  return {
    valid: true,
    department: null,
    error: null,
  };
}

function cleanFeeItems(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "At least one fee item is required."
    );
  }

  return items.map(
    (item, index) => {
      const name = String(
        item?.name || ""
      ).trim();

      const amount = Number(
        item?.amount
      );

      if (!name) {
        throw new Error(
          `Fee item ${
            index + 1
          } requires a name.`
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          `Fee item ${
            index + 1
          } has an invalid amount.`
        );
      }

      return {
        name,
        amount,
        sort_order: index + 1,
      };
    }
  );
}

function calculateTotal(items) {
  return items.reduce(
    (total, item) =>
      total + Number(item.amount),
    0
  );
}

function isRecordedPaymentStatus(status) {
  return [
    "paid",
    "successful",
    "completed",
  ].includes(
    String(status || "").toLowerCase()
  );
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Predivic Schools API is running",
    backend: "Supabase",
    status: "OK",
  });
});

// ======================================================
// TEST SUPABASE
// ======================================================

app.get(
  "/api/test-supabase",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("students")
        .select(
          "id, admission_no, first_name, last_name"
        )
        .limit(10);

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        count:
          data?.length || 0,
        students:
          data || [],
      });
    } catch (error) {
      console.error(
        "SUPABASE TEST ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ======================================================
// GET CLASSES
// ======================================================

app.get(
  "/api/classes",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("classes")
        .select(
          "id, name, display_order"
        );

      if (error) {
        throw error;
      }

      const classes = [
        ...(data || []),
      ].sort((a, b) => {
        const aIndex =
          CLASS_ORDER.indexOf(
            a.name
          );

        const bIndex =
          CLASS_ORDER.indexOf(
            b.name
          );

        return (
          (aIndex === -1
            ? 999
            : aIndex) -
          (bIndex === -1
            ? 999
            : bIndex)
        );
      });

      res.json(classes);
    } catch (error) {
      console.error(
        "GET CLASSES ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ======================================================
// GET STUDENTS
// ======================================================

app.get(
  "/api/students",
  async (req, res) => {
    try {
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
          status,
          student_type,
          date_of_birth,
          parent_name,
          parent_relationship,
          parent_phone,
          parent_email,
          address,
          admission_date,
          age,
          place_of_birth,
          nationality,
          state_of_origin,
          hometown,
          lga,
          religion,
          denomination,
          secondary_parent_name,
          secondary_parent_phone,
          emergency_contact_name,
          emergency_contact_phone,
          previous_school,
          medical_information,
          notes,
          created_at,
          updated_at
        `)
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      const {
        data: classes,
        error: classError,
      } = await supabase
        .from("classes")
        .select(
          "id, name, display_order"
        );

      if (classError) {
        throw classError;
      }

      const classMap =
        new Map(
          (classes || []).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const {
        data: currentSession,
        error: sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select("id")
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      let enrollmentMap =
        new Map();

      if (currentSession) {
        const {
          data: enrollments,
          error:
            enrollmentError,
        } = await supabase
          .from(
            "student_enrollments"
          )
          .select(`
            id,
            student_id,
            session_id,
            term_id,
            class_id,
            status
          `)
          .eq(
            "session_id",
            currentSession.id
          );

        if (enrollmentError) {
          throw enrollmentError;
        }

        enrollmentMap =
          new Map(
            (
              enrollments || []
            ).map(
              (item) => [
                item.student_id,
                item,
              ]
            )
          );
      }

      const result = (
        students || []
      ).map((student) => {
        const enrollment =
          enrollmentMap.get(
            student.id
          );

        const classId =
          enrollment?.class_id ||
          null;

        return {
          id:
            student.id,

          admissionNo:
            student.admission_no ||
            "",

          firstName:
            student.first_name ||
            "",

          middleName:
            student.middle_name ||
            "",

          lastName:
            student.last_name ||
            "",

          fullName: [
            student.first_name,
            student.middle_name,
            student.last_name,
          ]
            .filter(Boolean)
            .join(" "),

          gender:
            student.gender ||
            "",

          classId,

          className:
            classMap.get(
              classId
            ) || "",

          enrollmentId:
            enrollment?.id ||
            null,

          enrollmentStatus:
            enrollment?.status ||
            null,

          sessionId:
            enrollment?.session_id ||
            null,

          termId:
            enrollment?.term_id ||
            null,

          status:
            student.status ||
            "Active",

          studentType:
            student.student_type ||
            "returning",

          dateOfBirth:
            student.date_of_birth ||
            null,

          admissionDate:
            student.admission_date ||
            null,

          parentName:
            student.parent_name ||
            "",

          parentRelationship:
            student.parent_relationship ||
            "",

          parentPhone:
            student.parent_phone ||
            "",

          parentEmail:
            student.parent_email ||
            "",

          address:
            student.address ||
            "",

          age:
            student.age ?? "",

          placeOfBirth:
            student.place_of_birth ||
            "",

          nationality:
            student.nationality ||
            "",

          stateOfOrigin:
            student.state_of_origin ||
            "",

          hometown:
            student.hometown ||
            "",

          lga:
            student.lga ||
            "",

          religion:
            student.religion ||
            "",

          denomination:
            student.denomination ||
            "",

          secondaryParentName:
            student.secondary_parent_name ||
            "",

          secondaryParentPhone:
            student.secondary_parent_phone ||
            "",

          emergencyContactName:
            student.emergency_contact_name ||
            "",

          emergencyContactPhone:
            student.emergency_contact_phone ||
            "",

          previousSchool:
            student.previous_school ||
            "",

          medicalInformation:
            student.medical_information ||
            "",

          notes:
            student.notes ||
            "",

          createdAt:
            student.created_at ||
            null,

          updatedAt:
            student.updated_at ||
            null,
        };
      });

      res.json(result);
    } catch (error) {
      console.error(
        "GET STUDENTS ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// GET ONE STUDENT
// ======================================================

app.get(
  "/api/students/:id",
  async (req, res) => {
    try {
      const {
        data: student,
        error,
      } = await supabase
        .from("students")
        .select("*")
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!student) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      const {
        data: enrollments,
        error:
          enrollmentError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .select(`
          id,
          student_id,
          session_id,
          term_id,
          class_id,
          status,
          created_at,
          updated_at
        `)
        .eq(
          "student_id",
          student.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (enrollmentError) {
        throw enrollmentError;
      }

      const {
        data: currentSession,
        error:
          sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select(`
          id,
          name,
          is_active,
          starts_on,
          ends_on
        `)
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      const currentEnrollment =
        (
          enrollments || []
        ).find(
          (item) =>
            item.session_id ===
            currentSession?.id
        ) || null;

      let classRecord =
        null;

      if (
        currentEnrollment?.class_id
      ) {
        const {
          data,
          error:
            classError,
        } = await supabase
          .from("classes")
          .select(
            "id, name, display_order"
          )
          .eq(
            "id",
            currentEnrollment.class_id
          )
          .maybeSingle();

        if (classError) {
          throw classError;
        }

        classRecord =
          data;
      }

      const {
        data: guardians,
        error:
          guardianError,
      } = await supabase
        .from("guardians")
        .select("*")
        .eq(
          "student_id",
          student.id
        );

      if (guardianError) {
        throw guardianError;
      }

      const {
        data: admission,
        error:
          admissionError,
      } = await supabase
        .from("admissions")
        .select("*")
        .eq(
          "student_id",
          student.id
        )
        .maybeSingle();

      if (admissionError) {
        throw admissionError;
      }

      res.json({
        student,

        class:
          classRecord ||
          null,

        enrollment:
          currentEnrollment,

        enrollments:
          enrollments ||
          [],

        guardians:
          guardians ||
          [],

        admission:
          admission ||
          null,
      });
    } catch (error) {
      console.error(
        "GET ONE STUDENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);
// ======================================================
// CREATE STUDENT
// ======================================================

app.post(
  "/api/students",
  async (req, res) => {
    try {
      const {
        admissionNo,
        firstName,
        middleName,
        lastName,
        gender,
        classId,
        studentType,
        dateOfBirth,
        parentName,
        parentRelationship,
        parentPhone,
        parentEmail,
        address,
        admissionDate,
        age,
        placeOfBirth,
        nationality,
        stateOfOrigin,
        hometown,
        lga,
        religion,
        denomination,
        secondaryParentName,
        secondaryParentPhone,
        emergencyContactName,
        emergencyContactPhone,
        previousSchool,
        medicalInformation,
        notes,
      } = req.body;

      if (!firstName) {
        return res.status(400).json({
          error:
            "First name is required.",
        });
      }

      if (!lastName) {
        return res.status(400).json({
          error:
            "Last name is required.",
        });
      }

      if (!classId) {
        return res.status(400).json({
          error:
            "Class is required.",
        });
      }

      const {
        data: existingAdmission,
        error:
          admissionCheckError,
      } = await supabase
        .from("students")
        .select("id")
        .eq(
          "admission_no",
          admissionNo
        )
        .maybeSingle();

      if (admissionCheckError) {
        throw admissionCheckError;
      }

      if (
        admissionNo &&
        existingAdmission
      ) {
        return res.status(409).json({
          error:
            "Admission number already exists.",
        });
      }

      const {
        data: student,
        error,
      } = await supabase
        .from("students")
        .insert({
          admission_no:
            admissionNo ||
            null,

          first_name:
            firstName.trim(),

          middle_name:
            middleName?.trim() ||
            null,

          last_name:
            lastName.trim(),

          gender:
            gender || null,

          status:
            "Active",

          student_type:
            studentType ||
            "returning",

          date_of_birth:
            dateOfBirth ||
            null,

          parent_name:
            parentName?.trim() ||
            null,

          parent_relationship:
            parentRelationship?.trim() ||
            null,

          parent_phone:
            parentPhone?.trim() ||
            null,

          parent_email:
            parentEmail?.trim() ||
            null,

          address:
            address?.trim() ||
            null,

          admission_date:
            admissionDate ||
            null,

          age:
            age === "" ||
            age === undefined
              ? null
              : Number(age),

          place_of_birth:
            placeOfBirth?.trim() ||
            null,

          nationality:
            nationality?.trim() ||
            null,

          state_of_origin:
            stateOfOrigin?.trim() ||
            null,

          hometown:
            hometown?.trim() ||
            null,

          lga:
            lga?.trim() ||
            null,

          religion:
            religion?.trim() ||
            null,

          denomination:
            denomination?.trim() ||
            null,

          secondary_parent_name:
            secondaryParentName?.trim() ||
            null,

          secondary_parent_phone:
            secondaryParentPhone?.trim() ||
            null,

          emergency_contact_name:
            emergencyContactName?.trim() ||
            null,

          emergency_contact_phone:
            emergencyContactPhone?.trim() ||
            null,

          previous_school:
            previousSchool?.trim() ||
            null,

          medical_information:
            medicalInformation?.trim() ||
            null,

          notes:
            notes?.trim() ||
            null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Get the active academic session.
      const {
        data: session,
        error:
          sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select("id")
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      // Create an enrollment for the active
      // session and selected class.
      if (session) {
        const {
          data: existingEnrollment,
          error:
            enrollmentCheckError,
        } = await supabase
          .from(
            "student_enrollments"
          )
          .select("id")
          .eq(
            "student_id",
            student.id
          )
          .eq(
            "session_id",
            session.id
          )
          .eq(
            "class_id",
            classId
          )
          .maybeSingle();

        if (enrollmentCheckError) {
          throw enrollmentCheckError;
        }

        if (!existingEnrollment) {
          const {
            error:
              enrollmentInsertError,
          } = await supabase
            .from(
              "student_enrollments"
            )
            .insert({
              student_id:
                student.id,

              session_id:
                session.id,

              class_id:
                classId,

              status:
                "active",
            });

          if (
            enrollmentInsertError
          ) {
            throw enrollmentInsertError;
          }
        }
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
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// UPDATE STUDENT
// ======================================================

app.put(
  "/api/students/:id",
  async (req, res) => {
    try {
      const studentId =
        req.params.id;

      const {
        admissionNo,
        firstName,
        middleName,
        lastName,
        gender,
        classId,
        studentType,
        dateOfBirth,
        parentName,
        parentRelationship,
        parentPhone,
        parentEmail,
        address,
        admissionDate,
        age,
        placeOfBirth,
        nationality,
        stateOfOrigin,
        hometown,
        lga,
        religion,
        denomination,
        secondaryParentName,
        secondaryParentPhone,
        emergencyContactName,
        emergencyContactPhone,
        previousSchool,
        medicalInformation,
        notes,
        status,
      } = req.body;

      if (!firstName) {
        return res.status(400).json({
          error:
            "First name is required.",
        });
      }

      if (!lastName) {
        return res.status(400).json({
          error:
            "Last name is required.",
        });
      }

      const {
        data: student,
        error,
      } = await supabase
        .from("students")
        .update({
          admission_no:
            admissionNo ||
            null,

          first_name:
            firstName.trim(),

          middle_name:
            middleName?.trim() ||
            null,

          last_name:
            lastName.trim(),

          gender:
            gender || null,

          student_type:
            studentType ||
            "returning",

          date_of_birth:
            dateOfBirth ||
            null,

          parent_name:
            parentName?.trim() ||
            null,

          parent_relationship:
            parentRelationship?.trim() ||
            null,

          parent_phone:
            parentPhone?.trim() ||
            null,

          parent_email:
            parentEmail?.trim() ||
            null,

          address:
            address?.trim() ||
            null,

          admission_date:
            admissionDate ||
            null,

          age:
            age === "" ||
            age === undefined
              ? null
              : Number(age),

          place_of_birth:
            placeOfBirth?.trim() ||
            null,

          nationality:
            nationality?.trim() ||
            null,

          state_of_origin:
            stateOfOrigin?.trim() ||
            null,

          hometown:
            hometown?.trim() ||
            null,

          lga:
            lga?.trim() ||
            null,

          religion:
            religion?.trim() ||
            null,

          denomination:
            denomination?.trim() ||
            null,

          secondary_parent_name:
            secondaryParentName?.trim() ||
            null,

          secondary_parent_phone:
            secondaryParentPhone?.trim() ||
            null,

          emergency_contact_name:
            emergencyContactName?.trim() ||
            null,

          emergency_contact_phone:
            emergencyContactPhone?.trim() ||
            null,

          previous_school:
            previousSchool?.trim() ||
            null,

          medical_information:
            medicalInformation?.trim() ||
            null,

          notes:
            notes?.trim() ||
            null,

          status:
            status ||
            "Active",
        })
        .eq(
          "id",
          studentId
        )
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!student) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      // If a class was supplied, update/create
      // the active-session enrollment.
      if (classId) {
        const {
          data: session,
          error:
            sessionError,
        } = await supabase
          .from(
            "academic_sessions"
          )
          .select("id")
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          const {
            data: existingEnrollment,
            error:
              enrollmentCheckError,
          } = await supabase
            .from(
              "student_enrollments"
            )
            .select("id")
            .eq(
              "student_id",
              studentId
            )
            .eq(
              "session_id",
              session.id
            )
            .maybeSingle();

          if (enrollmentCheckError) {
            throw enrollmentCheckError;
          }

          if (existingEnrollment) {
            const {
              error:
                enrollmentUpdateError,
            } = await supabase
              .from(
                "student_enrollments"
              )
              .update({
                class_id:
                  classId,

                status:
                  "active",
              })
              .eq(
                "id",
                existingEnrollment.id
              );

            if (
              enrollmentUpdateError
            ) {
              throw enrollmentUpdateError;
            }
          } else {
            const {
              error:
                enrollmentInsertError,
            } = await supabase
              .from(
                "student_enrollments"
              )
              .insert({
                student_id:
                  studentId,

                session_id:
                  session.id,

                class_id:
                  classId,

                status:
                  "active",
              });

            if (
              enrollmentInsertError
            ) {
              throw enrollmentInsertError;
            }
          }
        }
      }

      res.json({
        message:
          "Student updated successfully.",

        student,
      });
    } catch (error) {
      console.error(
        "UPDATE STUDENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// DELETE STUDENT
// ======================================================

app.delete(
  "/api/students/:id",
  async (req, res) => {
    try {
      const studentId =
        req.params.id;

      const {
        data: existingStudent,
        error:
          studentCheckError,
      } = await supabase
        .from("students")
        .select("id")
        .eq(
          "id",
          studentId
        )
        .maybeSingle();

      if (studentCheckError) {
        throw studentCheckError;
      }

      if (!existingStudent) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      const {
        count: paymentCount,
        error:
          paymentCheckError,
      } = await supabase
        .from("payments")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_id",
          studentId
        );

      if (paymentCheckError) {
        throw paymentCheckError;
      }

      if (
        (paymentCount || 0) > 0
      ) {
        return res.status(400).json({
          error:
            "This student has payment records and cannot be deleted.",
        });
      }

      const {
        count:
          studentFeeCount,
        error:
          studentFeeCheckError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_id",
          studentId
        );

      if (studentFeeCheckError) {
        throw studentFeeCheckError;
      }

      if (
        (studentFeeCount || 0) >
        0
      ) {
        return res.status(400).json({
          error:
            "This student has assigned fee accounts and cannot be deleted.",
        });
      }

      const {
        error:
          enrollmentDeleteError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .delete()
        .eq(
          "student_id",
          studentId
        );

      if (enrollmentDeleteError) {
        throw enrollmentDeleteError;
      }

      const {
        error:
          guardianDeleteError,
      } = await supabase
        .from("guardians")
        .delete()
        .eq(
          "student_id",
          studentId
        );

      if (guardianDeleteError) {
        throw guardianDeleteError;
      }

      const {
        error:
          admissionDeleteError,
      } = await supabase
        .from("admissions")
        .delete()
        .eq(
          "student_id",
          studentId
        );

      if (admissionDeleteError) {
        throw admissionDeleteError;
      }

      const {
        error:
          deleteError,
      } = await supabase
        .from("students")
        .delete()
        .eq(
          "id",
          studentId
        );

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        message:
          "Student deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE STUDENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// GET FEE STRUCTURES
// ======================================================

app.get(
  "/api/fee-accounts",
  async (req, res) => {
    try {
      const {
        data: feeAccounts,
        error,
      } = await supabase
        .from("fee_accounts")
        .select(`
          id,
          class_id,
          academic_session_id,
          term_id,
          student_type,
          department,
          total_amount,
          notes,
          is_active,
          created_at,
          updated_at
        `)
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      const feeAccountIds = (
        feeAccounts || []
      ).map(
        (item) => item.id
      );

      let feeItems = [];

      if (
        feeAccountIds.length > 0
      ) {
        const {
          data,
          error:
            feeItemError,
        } = await supabase
          .from("fee_items")
          .select(`
            id,
            fee_account_id,
            name,
            amount,
            sort_order
          `)
          .in(
            "fee_account_id",
            feeAccountIds
          )
          .order(
            "sort_order",
            {
              ascending: true,
            }
          );

        if (feeItemError) {
          throw feeItemError;
        }

        feeItems =
          data || [];
      }

      const classIds = [
        ...new Set(
          (
            feeAccounts ||
            []
          )
            .map(
              (item) =>
                item.class_id
            )
            .filter(Boolean)
        ),
      ];

      const sessionIds = [
        ...new Set(
          (
            feeAccounts ||
            []
          )
            .map(
              (item) =>
                item.academic_session_id
            )
            .filter(Boolean)
        ),
      ];

      const termIds = [
        ...new Set(
          (
            feeAccounts ||
            []
          )
            .map(
              (item) =>
                item.term_id
            )
            .filter(Boolean)
        ),
      ];

      const [
        classesResult,
        sessionsResult,
        termsResult,
      ] = await Promise.all([
        classIds.length > 0
          ? supabase
              .from("classes")
              .select(
                "id, name"
              )
              .in(
                "id",
                classIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),

        sessionIds.length > 0
          ? supabase
              .from(
                "academic_sessions"
              )
              .select(
                "id, name"
              )
              .in(
                "id",
                sessionIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),

        termIds.length > 0
          ? supabase
              .from("terms")
              .select(
                "id, name"
              )
              .in(
                "id",
                termIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (
        classesResult.error
      ) {
        throw classesResult.error;
      }

      if (
        sessionsResult.error
      ) {
        throw sessionsResult.error;
      }

      if (
        termsResult.error
      ) {
        throw termsResult.error;
      }

      const classMap =
        new Map(
          (
            classesResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const sessionMap =
        new Map(
          (
            sessionsResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const termMap =
        new Map(
          (
            termsResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const itemsMap =
        new Map();

      feeItems.forEach(
        (item) => {
          if (
            !itemsMap.has(
              item.fee_account_id
            )
          ) {
            itemsMap.set(
              item.fee_account_id,
              []
            );
          }

          itemsMap
            .get(
              item.fee_account_id
            )
            .push({
              id:
                item.id,

              name:
                item.name,

              amount:
                Number(
                  item.amount
                ),

              sortOrder:
                item.sort_order,
            });
        }
      );

      const result = (
        feeAccounts || []
      ).map(
        (account) => ({
          id:
            account.id,

          classId:
            account.class_id,

          className:
            classMap.get(
              account.class_id
            ) ||
            "Unknown Class",

          academicSessionId:
            account.academic_session_id,

          session:
            sessionMap.get(
              account.academic_session_id
            ) ||
            "Unknown Session",

          termId:
            account.term_id,

          term:
            termMap.get(
              account.term_id
            ) ||
            "Unknown Term",

          studentType:
            account.student_type,

          department:
            account.department ||
            null,

          total:
            Number(
              account.total_amount ||
                0
            ),

          notes:
            account.notes ||
            "",

          isActive:
            account.is_active,

          feeItems:
            itemsMap.get(
              account.id
            ) || [],

          createdAt:
            account.created_at,

          updatedAt:
            account.updated_at,
        })
      );

      res.json(result);
    } catch (error) {
      console.error(
        "GET FEE STRUCTURES ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);
// ======================================================
// CREATE FEE STRUCTURE
// ======================================================

app.post(
  "/api/fee-accounts",
  async (req, res) => {
    try {
      const {
        session,
        term,
        className,
        department,
        studentType,
        feeItems,
        notes,
      } = req.body;

      if (!session) {
        return res.status(400).json({
          error:
            "Academic session is required.",
        });
      }

      if (!term) {
        return res.status(400).json({
          error:
            "Term is required.",
        });
      }

      if (!className) {
        return res.status(400).json({
          error:
            "Class is required.",
        });
      }

      if (!studentType) {
        return res.status(400).json({
          error:
            "Student type is required.",
        });
      }

      const departmentCheck =
        validateDepartment(
          className,
          department
        );

      if (!departmentCheck.valid) {
        return res.status(400).json({
          error:
            departmentCheck.error,
        });
      }

      const cleanedItems =
        cleanFeeItems(
          feeItems
        );

      const totalAmount =
        calculateTotal(
          cleanedItems
        );

      // Find session.
      const {
        data: sessionRecord,
        error:
          sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select("id, name")
        .eq(
          "name",
          session
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionRecord) {
        return res.status(400).json({
          error:
            `Academic session "${session}" was not found.`,
        });
      }

      // Find class.
      const {
        data: classRecord,
        error:
          classError,
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
            `Class "${className}" was not found.`,
        });
      }

      // Find term.
      const {
        data: termRecords,
        error:
          termError,
      } = await supabase
        .from("terms")
        .select("id, name");

      if (termError) {
        throw termError;
      }

      const requestedTerm =
        normalizeTerm(term);

      const termRecord =
        (
          termRecords || []
        ).find(
          (item) =>
            normalizeTerm(
              item.name
            ) ===
            requestedTerm
        );

      if (!termRecord) {
        return res.status(400).json({
          error:
            `Term "${term}" was not found.`,
        });
      }

      // Prevent duplicate fee structures.
      const {
        data: duplicateQuery,
        error:
          duplicateError,
      } = await supabase
        .from("fee_accounts")
        .select("id")
        .eq(
          "class_id",
          classRecord.id
        )
        .eq(
          "academic_session_id",
          sessionRecord.id
        )
        .eq(
          "term_id",
          termRecord.id
        )
        .eq(
          "student_type",
          studentType
        )
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      // SS2/SS3 may legitimately have three
      // department-specific structures, so only
      // treat the record as duplicate when the
      // department also matches.
      let existingStructure =
        null;

      if (
        duplicateQuery
      ) {
        const {
          data,
          error:
            existingError,
        } = await supabase
          .from("fee_accounts")
          .select(
            "id, department"
          )
          .eq(
            "id",
            duplicateQuery.id
          )
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        existingStructure =
          data;
      }

      if (
        existingStructure &&
        (
          existingStructure.department ||
          null
        ) ===
          (
            departmentCheck.department ||
            null
          )
      ) {
        return res.status(409).json({
          error:
            "A fee structure already exists for this class, session, term, student type and department.",
        });
      }

      const {
        data: feeAccount,
        error:
          insertError,
      } = await supabase
        .from("fee_accounts")
        .insert({
          class_id:
            classRecord.id,

          academic_session_id:
            sessionRecord.id,

          term_id:
            termRecord.id,

          student_type:
            studentType,

          department:
            departmentCheck.department,

          total_amount:
            totalAmount,

          notes:
            notes?.trim() ||
            null,

          is_active:
            true,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const itemsToInsert =
        cleanedItems.map(
          (item) => ({
            fee_account_id:
              feeAccount.id,

            name:
              item.name,

            amount:
              item.amount,

            sort_order:
              item.sort_order,
          })
        );

      const {
        data: insertedItems,
        error:
          itemInsertError,
      } = await supabase
        .from("fee_items")
        .insert(
          itemsToInsert
        )
        .select();

      if (itemInsertError) {
        // Roll back the parent record if fee items
        // could not be inserted.
        await supabase
          .from("fee_accounts")
          .delete()
          .eq(
            "id",
            feeAccount.id
          );

        throw itemInsertError;
      }

      res.status(201).json({
        message:
          "Fee structure created successfully.",

        feeAccount: {
          ...feeAccount,

          className:
            className,

          session:
            sessionRecord.name,

          term:
            termRecord.name,

          feeItems:
            insertedItems ||
            [],

          total:
            totalAmount,
        },
      });
    } catch (error) {
      console.error(
        "CREATE FEE STRUCTURE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// UPDATE FEE STRUCTURE
// ======================================================

app.put(
  "/api/fee-accounts/:id",
  async (req, res) => {
    try {
      const feeAccountId =
        req.params.id;

      const {
        session,
        term,
        className,
        department,
        studentType,
        feeItems,
        notes,
      } = req.body;

      if (!session) {
        return res.status(400).json({
          error:
            "Academic session is required.",
        });
      }

      if (!term) {
        return res.status(400).json({
          error:
            "Term is required.",
        });
      }

      if (!className) {
        return res.status(400).json({
          error:
            "Class is required.",
        });
      }

      if (!studentType) {
        return res.status(400).json({
          error:
            "Student type is required.",
        });
      }

      const departmentCheck =
        validateDepartment(
          className,
          department
        );

      if (!departmentCheck.valid) {
        return res.status(400).json({
          error:
            departmentCheck.error,
        });
      }

      const cleanedItems =
        cleanFeeItems(
          feeItems
        );

      const totalAmount =
        calculateTotal(
          cleanedItems
        );

      const {
        data: sessionRecord,
        error:
          sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select("id, name")
        .eq(
          "name",
          session
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionRecord) {
        return res.status(400).json({
          error:
            `Academic session "${session}" was not found.`,
        });
      }

      const {
        data: classRecord,
        error:
          classError,
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
            `Class "${className}" was not found.`,
        });
      }

      const {
        data: termRecords,
        error:
          termError,
      } = await supabase
        .from("terms")
        .select("id, name");

      if (termError) {
        throw termError;
      }

      const requestedTerm =
        normalizeTerm(term);

      const termRecord =
        (
          termRecords || []
        ).find(
          (item) =>
            normalizeTerm(
              item.name
            ) ===
            requestedTerm
        );

      if (!termRecord) {
        return res.status(400).json({
          error:
            `Term "${term}" was not found.`,
        });
      }

      const {
        data: existing,
        error:
          existingError,
      } = await supabase
        .from("fee_accounts")
        .select("id")
        .eq(
          "id",
          feeAccountId
        )
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existing) {
        return res.status(404).json({
          error:
            "Fee structure not found.",
        });
      }

      const {
        data: updatedAccount,
        error:
          updateError,
      } = await supabase
        .from("fee_accounts")
        .update({
          class_id:
            classRecord.id,

          academic_session_id:
            sessionRecord.id,

          term_id:
            termRecord.id,

          student_type:
            studentType,

          department:
            departmentCheck.department,

          total_amount:
            totalAmount,

          notes:
            notes?.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          feeAccountId
        )
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Replace fee items.
      const {
        error:
          deleteItemsError,
      } = await supabase
        .from("fee_items")
        .delete()
        .eq(
          "fee_account_id",
          feeAccountId
        );

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      const itemsToInsert =
        cleanedItems.map(
          (item) => ({
            fee_account_id:
              feeAccountId,

            name:
              item.name,

            amount:
              item.amount,

            sort_order:
              item.sort_order,
          })
        );

      const {
        data: updatedItems,
        error:
          insertItemsError,
      } = await supabase
        .from("fee_items")
        .insert(
          itemsToInsert
        )
        .select();

      if (insertItemsError) {
        throw insertItemsError;
      }

      res.json({
        message:
          "Fee structure updated successfully.",

        feeAccount: {
          ...updatedAccount,

          className:
            className,

          session:
            sessionRecord.name,

          term:
            termRecord.name,

          feeItems:
            updatedItems ||
            [],

          total:
            totalAmount,
        },
      });
    } catch (error) {
      console.error(
        "UPDATE FEE STRUCTURE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// DELETE FEE STRUCTURE
// ======================================================

app.delete(
  "/api/fee-accounts/:id",
  async (req, res) => {
    try {
      const feeAccountId =
        req.params.id;

      // Do not allow deletion when students have
      // already been assigned this structure.
      const {
        count,
        error:
          assignmentCheckError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "fee_account_id",
          feeAccountId
        );

      if (assignmentCheckError) {
        throw assignmentCheckError;
      }

      if ((count || 0) > 0) {
        return res.status(400).json({
          error:
            "This fee structure has already been assigned to students and cannot be deleted.",
        });
      }

      const {
        data: existing,
        error:
          findError,
      } = await supabase
        .from("fee_accounts")
        .select("id")
        .eq(
          "id",
          feeAccountId
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!existing) {
        return res.status(404).json({
          error:
            "Fee structure not found.",
        });
      }

      const {
        error:
          deleteItemsError,
      } = await supabase
        .from("fee_items")
        .delete()
        .eq(
          "fee_account_id",
          feeAccountId
        );

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      const {
        error:
          deleteAccountError,
      } = await supabase
        .from("fee_accounts")
        .delete()
        .eq(
          "id",
          feeAccountId
        );

      if (deleteAccountError) {
        throw deleteAccountError;
      }

      res.json({
        message:
          "Fee structure deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE FEE STRUCTURE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// STUDENT FEE ACCOUNTS
// ======================================================
// IMPORTANT:
//
// fee_accounts
//     = reusable fee structures
//
// student_fee_accounts
//     = fees actually assigned to students
//
// ======================================================
// PAYMENTS
// ======================================================

// Payment creation is intentionally delegated to the database function from
// supabase/migrations/20260827123000_payment_recorder_mvp.sql.  That function
// locks the fee account, prevents overpayment, updates its status, and creates
// the receipt in one transaction.
app.post(
  "/api/payments",
  async (req, res) => {
    try {
      const {
        studentId,
        studentFeeAccountId,
        amount,
        method,
        paymentDate,
        notes,
        reference,
      } = req.body;

      const numericAmount = Number(amount);

      if (!studentId || !studentFeeAccountId) {
        return res.status(400).json({
          error: "Student and fee account are required.",
        });
      }

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          error: "Payment amount must be greater than zero.",
        });
      }

      if (!String(method || "").trim()) {
        return res.status(400).json({
          error: "Payment method is required.",
        });
      }

      if (
        paymentDate &&
        !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
      ) {
        return res.status(400).json({
          error: "Payment date must use YYYY-MM-DD.",
        });
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "record_payment",
        {
          p_student_id: studentId,
          p_student_fee_account_id:
            studentFeeAccountId,
          p_amount: numericAmount,
          p_method: String(method).trim(),
          p_payment_date:
            paymentDate || null,
          p_notes: notes || null,
          p_reference: reference || null,
        }
      );

      if (error) {
        const isValidationError =
          error.code === "P0001";

        return res.status(
          isValidationError ? 400 : 500
        ).json({
          error: error.message,
        });
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      res.status(201).json({
        paymentId: result.payment_id,
        receiptNumber:
          result.receipt_number,
        totalPaid: Number(result.total_paid),
        balance: Number(result.balance),
        status: result.account_status,
      });
    } catch (error) {
      console.error(
        "CREATE PAYMENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Unable to record payment.",
      });
    }
  }
);

app.get(
  "/api/payments",
  async (req, res) => {
    try {
      const {
        data: payments,
        error: paymentsError,
      } = await supabase
        .from("payments")
        .select(`
          id,
          student_id,
          student_fee_account_id,
          amount,
          payment_date,
          method,
          reference,
          status,
          notes,
          created_at
        `)
        .order(
          "payment_date",
          {
            ascending: false,
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (paymentsError) {
        throw paymentsError;
      }

      const paymentIds = (payments || []).map(
        (item) => item.id
      );
      const studentIds = [
        ...new Set(
          (payments || [])
            .map((item) => item.student_id)
            .filter(Boolean)
        ),
      ];
      const studentFeeAccountIds = [
        ...new Set(
          (payments || [])
            .map(
              (item) =>
                item.student_fee_account_id
            )
            .filter(Boolean)
        ),
      ];

      const [
        studentsResult,
        studentFeeAccountsResult,
        receiptsResult,
      ] = await Promise.all([
        studentIds.length > 0
          ? supabase
              .from("students")
              .select(`
                id,
                admission_no,
                first_name,
                middle_name,
                last_name
              `)
              .in("id", studentIds)
          : Promise.resolve({
              data: [],
              error: null,
            }),
        studentFeeAccountIds.length > 0
          ? supabase
              .from("student_fee_accounts")
              .select(`
                id,
                fee_account_id,
                total_amount
              `)
              .in("id", studentFeeAccountIds)
          : Promise.resolve({
              data: [],
              error: null,
            }),
        paymentIds.length > 0
          ? supabase
              .from("receipts")
              .select(`
                payment_id,
                receipt_number,
                issued_at
              `)
              .in("payment_id", paymentIds)
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (studentsResult.error) {
        throw studentsResult.error;
      }

      if (studentFeeAccountsResult.error) {
        throw studentFeeAccountsResult.error;
      }

      if (receiptsResult.error) {
        throw receiptsResult.error;
      }

      const students = studentsResult.data || [];
      const studentFeeAccounts =
        studentFeeAccountsResult.data || [];
      const receipts = receiptsResult.data || [];
      const feeAccountIds = [
        ...new Set(
          studentFeeAccounts
            .map((item) => item.fee_account_id)
            .filter(Boolean)
        ),
      ];

      const {
        data: feeAccounts,
        error: feeAccountsError,
      } = feeAccountIds.length > 0
        ? await supabase
            .from("fee_accounts")
            .select("id, class_id")
            .in("id", feeAccountIds)
        : {
            data: [],
            error: null,
          };

      if (feeAccountsError) {
        throw feeAccountsError;
      }

      const classIds = [
        ...new Set(
          (feeAccounts || [])
            .map((item) => item.class_id)
            .filter(Boolean)
        ),
      ];
      const {
        data: classes,
        error: classesError,
      } = classIds.length > 0
        ? await supabase
            .from("classes")
            .select("id, name")
            .in("id", classIds)
        : {
            data: [],
            error: null,
          };

      if (classesError) {
        throw classesError;
      }

      const studentMap = new Map(
        students.map((student) => [
          student.id,
          student,
        ])
      );
      const accountMap = new Map(
        studentFeeAccounts.map((account) => [
          account.id,
          account,
        ])
      );
      const feeAccountMap = new Map(
        (feeAccounts || []).map((account) => [
          account.id,
          account,
        ])
      );
      const classMap = new Map(
        (classes || []).map((item) => [
          item.id,
          item.name,
        ])
      );
      const receiptMap = new Map(
        receipts.map((receipt) => [
          receipt.payment_id,
          receipt,
        ])
      );

      res.json(
        (payments || []).map((payment) => {
          const student = studentMap.get(
            payment.student_id
          );
          const studentFeeAccount = accountMap.get(
            payment.student_fee_account_id
          );
          const feeAccount = feeAccountMap.get(
            studentFeeAccount?.fee_account_id
          );
          const receipt = receiptMap.get(payment.id);

          return {
            id: payment.id,
            studentId: payment.student_id,
            studentFeeAccountId:
              payment.student_fee_account_id,
            studentName: student
              ? [
                  student.first_name,
                  student.middle_name,
                  student.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")
              : "Unknown Student",
            admissionNo:
              student?.admission_no || "",
            className:
              classMap.get(
                feeAccount?.class_id
              ) || "Unknown Class",
            amount: Number(payment.amount),
            method: payment.method || "",
            paymentDate: payment.payment_date,
            status: isRecordedPaymentStatus(
              payment.status
            )
              ? "Paid"
              : payment.status || "Unknown",
            notes: payment.notes || "",
            reference: payment.reference || "",
            receiptNumber:
              receipt?.receipt_number || null,
            receiptIssuedAt:
              receipt?.issued_at || null,
          };
        })
      );
    } catch (error) {
      console.error(
        "GET PAYMENTS ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Unable to load payments.",
      });
    }
  }
);

// ======================================================
// STUDENT FEE ACCOUNTS
//     = money actually received
//
// This separation prevents fee structures from appearing
// as "Unknown Student" records.

// ======================================================
// GET STUDENT FEE ACCOUNTS
// ======================================================

app.get(
  "/api/student-fee-accounts",
  async (req, res) => {
    try {
      const {
        data: accounts,
        error:
          accountsError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select(`
          id,
          student_id,
          enrollment_id,
          fee_account_id,
          total_amount,
          status,
          notes,
          created_at,
          updated_at
        `)
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (accountsError) {
        throw accountsError;
      }

      const studentIds = [
        ...new Set(
          (
            accounts || []
          )
            .map(
              (item) =>
                item.student_id
            )
            .filter(Boolean)
        ),
      ];

      const feeAccountIds = [
        ...new Set(
          (
            accounts || []
          )
            .map(
              (item) =>
                item.fee_account_id
            )
            .filter(Boolean)
        ),
      ];

      let students = [];
      let feeStructures = [];

      if (
        studentIds.length > 0
      ) {
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
            student_type,
            status
          `)
          .in(
            "id",
            studentIds
          );

        if (error) {
          throw error;
        }

        students =
          data || [];
      }

      if (
        feeAccountIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("fee_accounts")
          .select(`
            id,
            class_id,
            academic_session_id,
            term_id,
            student_type,
            department,
            total_amount,
            is_active
          `)
          .in(
            "id",
            feeAccountIds
          );

        if (error) {
          throw error;
        }

        feeStructures =
          data || [];
      }

      const classIds = [
        ...new Set(
          feeStructures
            .map(
              (item) =>
                item.class_id
            )
            .filter(Boolean)
        ),
      ];

      const sessionIds = [
        ...new Set(
          feeStructures
            .map(
              (item) =>
                item.academic_session_id
            )
            .filter(Boolean)
        ),
      ];

      const termIds = [
        ...new Set(
          feeStructures
            .map(
              (item) =>
                item.term_id
            )
            .filter(Boolean)
        ),
      ];

      const [
        classResult,
        sessionResult,
        termResult,
      ] = await Promise.all([
        classIds.length > 0
          ? supabase
              .from("classes")
              .select(
                "id, name"
              )
              .in(
                "id",
                classIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),

        sessionIds.length > 0
          ? supabase
              .from(
                "academic_sessions"
              )
              .select(
                "id, name"
              )
              .in(
                "id",
                sessionIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),

        termIds.length > 0
          ? supabase
              .from("terms")
              .select(
                "id, name"
              )
              .in(
                "id",
                termIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (
        classResult.error
      ) {
        throw classResult.error;
      }

      if (
        sessionResult.error
      ) {
        throw sessionResult.error;
      }

      if (
        termResult.error
      ) {
        throw termResult.error;
      }

      const studentMap =
        new Map(
          students.map(
            (student) => [
              student.id,
              student,
            ]
          )
        );

      const feeStructureMap =
        new Map(
          feeStructures.map(
            (structure) => [
              structure.id,
              structure,
            ]
          )
        );

      const classMap =
        new Map(
          (
            classResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const sessionMap =
        new Map(
          (
            sessionResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const termMap =
        new Map(
          (
            termResult.data ||
            []
          ).map(
            (item) => [
              item.id,
              item.name,
            ]
          )
        );

      const studentFeeAccountIds =
        [
          ...new Set(
            (
              accounts || []
            ).map(
              (item) =>
                item.id
            )
          ),
        ];

      let payments = [];

      if (
        studentFeeAccountIds.length >
        0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("payments")
          .select(`
            id,
            student_fee_account_id,
            amount,
            status
          `)
          .in(
            "student_fee_account_id",
            studentFeeAccountIds
          );

        if (error) {
          throw error;
        }

        payments =
          data || [];
      }

      const paidMap =
        new Map();

      payments.forEach(
        (payment) => {
          const paymentStatus =
            String(
              payment.status ||
                ""
            ).toLowerCase();

          if (
            paymentStatus &&
            !isRecordedPaymentStatus(
              paymentStatus
            )
          ) {
            return;
          }

          const current =
            paidMap.get(
              payment.student_fee_account_id
            ) || 0;

          paidMap.set(
            payment.student_fee_account_id,
            current +
              Number(
                payment.amount ||
                  0
              )
          );
        }
      );

      const result = (
        accounts || []
      ).map(
        (account) => {
          const student =
            studentMap.get(
              account.student_id
            ) || null;

          const structure =
            feeStructureMap.get(
              account.fee_account_id
            ) || null;

          const totalAmount =
            Number(
              account.total_amount ??
                structure?.total_amount ??
                0
            );

          const totalPaid =
            Number(
              paidMap.get(
                account.id
              ) || 0
            );

          const balance =
            Math.max(
              totalAmount -
                totalPaid,
              0
            );

          const status =
            balance <= 0
              ? "Paid"
              : totalPaid > 0
              ? "Part Payment"
              : "Unpaid";

          return {
            id:
              account.id,

            studentId:
              account.student_id,

            enrollmentId:
              account.enrollment_id,

            feeAccountId:
              account.fee_account_id,

            student:
              student
                ? {
                    id:
                      student.id,

                    admissionNo:
                      student.admission_no ||
                      "",

                    firstName:
                      student.first_name ||
                      "",

                    middleName:
                      student.middle_name ||
                      "",

                    lastName:
                      student.last_name ||
                      "",

                    fullName: [
                      student.first_name,
                      student.middle_name,
                      student.last_name,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " "
                      ),

                    studentType:
                      student.student_type ||
                      "",

                    status:
                      student.status ||
                      "",
                  }
                : null,

            classId:
              structure?.class_id ||
              null,

            className:
              structure
                ? classMap.get(
                    structure.class_id
                  ) ||
                  "Unknown Class"
                : "Unknown Class",

            academicSessionId:
              structure?.academic_session_id ||
              null,

            session:
              structure
                ? sessionMap.get(
                    structure.academic_session_id
                  ) ||
                  "Unknown Session"
                : "Unknown Session",

            termId:
              structure?.term_id ||
              null,

            term:
              structure
                ? termMap.get(
                    structure.term_id
                  ) ||
                  "Unknown Term"
                : "Unknown Term",

            studentType:
              structure?.student_type ||
              student?.student_type ||
              "",

            department:
              structure?.department ||
              null,

            totalAmount,

            totalPaid,

            balance,

            status,

            notes:
              account.notes ||
              "",

            createdAt:
              account.created_at,

            updatedAt:
              account.updated_at,
          };
        }
      );

      res.json(result);
    } catch (error) {
      console.error(
        "GET STUDENT FEE ACCOUNTS ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// GET ONE STUDENT FEE ACCOUNT
// ======================================================

app.get(
  "/api/student-fee-accounts/:id",
  async (req, res) => {
    try {
      const {
        data: account,
        error,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select(`
          id,
          student_id,
          enrollment_id,
          fee_account_id,
          total_amount,
          status,
          notes,
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

      if (!account) {
        return res.status(404).json({
          error:
            "Student fee account not found.",
        });
      }

      const {
        data: student,
        error:
          studentError,
      } = await supabase
        .from("students")
        .select(`
          id,
          admission_no,
          first_name,
          middle_name,
          last_name,
          student_type,
          status
        `)
        .eq(
          "id",
          account.student_id
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      const {
        data: structure,
        error:
          structureError,
      } = await supabase
        .from("fee_accounts")
        .select(`
          id,
          class_id,
          academic_session_id,
          term_id,
          student_type,
          department,
          total_amount
        `)
        .eq(
          "id",
          account.fee_account_id
        )
        .maybeSingle();

      if (structureError) {
        throw structureError;
      }

      const {
        data: payments,
        error:
          paymentsError,
      } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          method,
          reference,
          status,
          notes
        `)
        .eq(
          "student_fee_account_id",
          account.id
        )
        .order(
          "payment_date",
          {
            ascending: false,
          }
        );

      if (paymentsError) {
        throw paymentsError;
      }

      const totalAmount =
        Number(
          account.total_amount ??
            structure?.total_amount ??
            0
        );

      const totalPaid =
        (
          payments || []
        ).reduce(
          (
            sum,
            payment
          ) => {
            const paymentStatus =
              String(
                payment.status ||
                  ""
              ).toLowerCase();

            if (
              paymentStatus &&
              !isRecordedPaymentStatus(
                paymentStatus
              )
            ) {
              return sum;
            }

            return (
              sum +
              Number(
                payment.amount ||
                  0
              )
            );
          },
          0
        );

      res.json({
        ...account,

        student:
          student || null,

        feeStructure:
          structure || null,

        totalAmount,

        totalPaid,

        balance:
          Math.max(
            totalAmount -
              totalPaid,
            0
          ),

        status:
          totalAmount -
            totalPaid <=
          0
            ? "Paid"
            : totalPaid > 0
            ? "Part Payment"
            : "Unpaid",

        payments:
          payments || [],
      });
    } catch (error) {
      console.error(
        "GET ONE STUDENT FEE ACCOUNT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// ASSIGN FEE STRUCTURE TO STUDENT
// ======================================================

app.post(
  "/api/student-fee-accounts",
  async (req, res) => {
    try {
      const {
        studentId,
        feeAccountId,
        enrollmentId,
        status,
        notes,
      } = req.body;

      if (!studentId) {
        return res.status(400).json({
          error:
            "Student is required.",
        });
      }

      if (!feeAccountId) {
        return res.status(400).json({
          error:
            "Fee structure is required.",
        });
      }

      if (
        status !== undefined &&
        status !== "outstanding"
      ) {
        return res.status(400).json({
          error:
            "A newly assigned fee account must have outstanding status.",
        });
      }

      const {
        data: student,
        error:
          studentError,
      } = await supabase
        .from("students")
        .select(
          "id, status"
        )
        .eq(
          "id",
          studentId
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      const {
        data: feeStructure,
        error:
          feeStructureError,
      } = await supabase
        .from("fee_accounts")
        .select(`
          id,
          class_id,
          academic_session_id,
          term_id,
          student_type,
          total_amount,
          is_active
        `)
        .eq(
          "id",
          feeAccountId
        )
        .maybeSingle();

      if (feeStructureError) {
        throw feeStructureError;
      }

      if (!feeStructure) {
        return res.status(404).json({
          error:
            "Fee structure not found.",
        });
      }

      if (
        !feeStructure.is_active
      ) {
        return res.status(400).json({
          error:
            "This fee structure is inactive.",
        });
      }

      // Prevent duplicate assignment.
      const {
        data: existing,
        error:
          existingError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select("id")
        .eq(
          "student_id",
          studentId
        )
        .eq(
          "fee_account_id",
          feeAccountId
        )
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        return res.status(409).json({
          error:
            "This fee structure is already assigned to the student.",
          id:
            existing.id,
        });
      }

      let selectedEnrollmentId =
        enrollmentId ||
        null;

      if (
        !selectedEnrollmentId
      ) {
        const {
          data: enrollment,
          error:
            enrollmentError,
        } = await supabase
          .from(
            "student_enrollments"
          )
          .select(`
            id,
            student_id,
            session_id,
            class_id,
            status
          `)
          .eq(
            "student_id",
            studentId
          )
          .eq(
            "session_id",
            feeStructure.academic_session_id
          )
          .eq(
            "class_id",
            feeStructure.class_id
          )
          .eq(
            "status",
            "active"
          )
          .maybeSingle();

        if (enrollmentError) {
          throw enrollmentError;
        }

        selectedEnrollmentId =
          enrollment?.id ||
          null;
      }

      const {
        data:
          studentFeeAccount,
        error:
          insertError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .insert({
          student_id:
            studentId,

          enrollment_id:
            selectedEnrollmentId,

          fee_account_id:
            feeAccountId,

          total_amount:
            Number(
              feeStructure.total_amount
            ) || 0,

          status:
            "outstanding",

          notes:
            notes?.trim() ||
            null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      res.status(201).json({
        message:
          "Fee structure assigned to student successfully.",

        studentFeeAccount:
          studentFeeAccount,
      });
    } catch (error) {
      console.error(
        "ASSIGN FEE STRUCTURE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

// ======================================================
// DELETE STUDENT FEE ACCOUNT
// ======================================================

app.delete(
  "/api/student-fee-accounts/:id",
  async (req, res) => {
    try {
      const {
        data: existing,
        error:
          findError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .select("id")
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!existing) {
        return res.status(404).json({
          error:
            "Student fee account not found.",
        });
      }

      const {
        count,
        error:
          paymentError,
      } = await supabase
        .from("payments")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_fee_account_id",
          req.params.id
        );

      if (paymentError) {
        throw paymentError;
      }

      if ((count || 0) > 0) {
        return res.status(400).json({
          error:
            "This student fee account has payments and cannot be deleted.",
        });
      }

      const {
        error:
          deleteError,
      } = await supabase
        .from(
          "student_fee_accounts"
        )
        .delete()
        .eq(
          "id",
          req.params.id
        );

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        message:
          "Student fee account deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE STUDENT FEE ACCOUNT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);
// ======================================================
// RETURNING STUDENT SEARCH
// ======================================================

app.get(
  "/api/returning-students/search",
  async (req, res) => {
    try {
      const {
        admissionNo,
        firstName,
        lastName,
        dateOfBirth,
        parentPhone,
      } = req.query;

      if (
        !admissionNo &&
        !firstName &&
        !lastName &&
        !dateOfBirth &&
        !parentPhone
      ) {
        return res.status(400).json({
          error:
            "Enter at least one search field.",
        });
      }

      let query = supabase
        .from("students")
        .select(`
          id,
          admission_no,
          first_name,
          middle_name,
          last_name,
          gender,
          date_of_birth,
          parent_name,
          parent_relationship,
          parent_phone,
          parent_email,
          address,
          status,
          student_type
        `)
        .eq("status", "Active")
        .limit(20);

      if (admissionNo?.trim()) {
        query = query.eq(
          "admission_no",
          admissionNo.trim()
        );
      } else {
        if (firstName?.trim()) {
          query = query.ilike(
            "first_name",
            `%${firstName.trim()}%`
          );
        }

        if (lastName?.trim()) {
          query = query.ilike(
            "last_name",
            `%${lastName.trim()}%`
          );
        }

        if (dateOfBirth) {
          query = query.eq(
            "date_of_birth",
            dateOfBirth
          );
        }

        if (parentPhone?.trim()) {
          query = query.ilike(
            "parent_phone",
            `%${parentPhone.trim()}%`
          );
        }
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
        "RETURNING STUDENT SEARCH ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Unable to search for returning student.",
      });
    }
  }
);

// ======================================================
// REGISTER RETURNING STUDENT
// ======================================================

app.post(
  "/api/students/returning",
  async (req, res) => {
    try {
      const {
        studentId,
        classId,
      } = req.body;

      if (!studentId) {
        return res.status(400).json({
          error:
            "Student ID is required.",
        });
      }

      if (!classId) {
        return res.status(400).json({
          error:
            "Class is required.",
        });
      }

      // --------------------------------------------------
      // FIND EXISTING STUDENT
      // --------------------------------------------------

      const {
        data: student,
        error:
          studentError,
      } = await supabase
        .from("students")
        .select(`
          id,
          admission_no,
          first_name,
          middle_name,
          last_name,
          status
        `)
        .eq(
          "id",
          studentId
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        return res.status(404).json({
          error:
            "Existing student was not found.",
        });
      }

      if (
        String(
          student.status
        ).toLowerCase() !==
        "active"
      ) {
        return res.status(400).json({
          error:
            "This student is not active.",
        });
      }

      // --------------------------------------------------
      // FIND CLASS
      // --------------------------------------------------

      const {
        data: classRecord,
        error:
          classError,
      } = await supabase
        .from("classes")
        .select(
          "id, name"
        )
        .eq(
          "id",
          classId
        )
        .maybeSingle();

      if (classError) {
        throw classError;
      }

      if (!classRecord) {
        return res.status(404).json({
          error:
            "Selected class was not found.",
        });
      }

      // --------------------------------------------------
      // FIND ACTIVE SESSION
      // --------------------------------------------------

      const {
        data: session,
        error:
          sessionError,
      } = await supabase
        .from(
          "academic_sessions"
        )
        .select(
          "id, name, is_active"
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
        return res.status(400).json({
          error:
            "No active academic session exists.",
        });
      }

      // --------------------------------------------------
      // CHECK WHETHER ALREADY ENROLLED
      // --------------------------------------------------

      const {
        data:
          existingEnrollment,
        error:
          enrollmentCheckError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .select(`
          id,
          student_id,
          session_id,
          term_id,
          class_id,
          status
        `)
        .eq(
          "student_id",
          studentId
        )
        .eq(
          "session_id",
          session.id
        )
        .maybeSingle();

      if (enrollmentCheckError) {
        throw enrollmentCheckError;
      }

      if (existingEnrollment) {
        return res.status(409).json({
          error:
            "This student is already enrolled for the current academic session.",
          enrollment:
            existingEnrollment,
        });
      }

      // --------------------------------------------------
      // FIND ACTIVE TERM
      // --------------------------------------------------

      const {
        data: term,
        error:
          termError,
      } = await supabase
        .from("terms")
        .select(`
          id,
          name,
          academic_session_id,
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

      if (!term) {
        return res.status(400).json({
          error:
            "No active term exists for the current academic session.",
        });
      }

      // --------------------------------------------------
      // CREATE NEW ENROLLMENT
      // --------------------------------------------------

      const {
        data: enrollment,
        error:
          enrollmentError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .insert({
          student_id:
            studentId,

          session_id:
            session.id,

          term_id:
            term.id,

          class_id:
            classId,

          status:
            "active",
        })
        .select()
        .single();

      if (enrollmentError) {
        throw enrollmentError;
      }

      // --------------------------------------------------
      // MARK STUDENT AS RETURNING
      // --------------------------------------------------

      const {
        error:
          updateStudentError,
      } = await supabase
        .from("students")
        .update({
          student_type:
            "returning",
        })
        .eq(
          "id",
          studentId
        );

      if (updateStudentError) {
        console.error(
          "UPDATE STUDENT TYPE ERROR:",
          updateStudentError
        );
      }

      res.status(201).json({
        message:
          "Returning student registered successfully.",

        student: {
          id:
            student.id,

          admissionNo:
            student.admission_no,

          fullName: [
            student.first_name,
            student.middle_name,
            student.last_name,
          ]
            .filter(Boolean)
            .join(" "),
        },

        enrollment: {
          id:
            enrollment.id,

          studentId:
            enrollment.student_id,

          sessionId:
            enrollment.session_id,

          termId:
            enrollment.term_id,

          classId:
            enrollment.class_id,

          className:
            classRecord.name,

          sessionName:
            session.name,

          termName:
            term.name,

          status:
            enrollment.status,
        },
      });
    } catch (error) {
      console.error(
        "REGISTER RETURNING STUDENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Unable to register returning student.",
      });
    }
  }
);

// ======================================================
// SERVER START
// ======================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Predivic Schools API running on http://localhost:${PORT}`
    );
  }
);
