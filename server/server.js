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
    message:
      "Predvic School Portal API is running",
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

      if (error) throw error;

      res.json({
        success: true,
        count: data?.length || 0,
        students: data || [],
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

      if (error) throw error;

      const classes = [
        ...(data || []),
      ].sort((a, b) => {
        const aIndex =
          CLASS_ORDER.indexOf(a.name);

        const bIndex =
          CLASS_ORDER.indexOf(b.name);

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

      if (error) throw error;

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

      const classMap = new Map(
        (classes || []).map(
          (item) => [
            item.id,
            item.name,
          ]
        )
      );

      // --------------------------------------------------
      // GET ACTIVE ACADEMIC SESSION
      // --------------------------------------------------

      const {
        data: currentSession,
        error: sessionError,
      } = await supabase
        .from("academic_sessions")
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
          error: enrollmentError,
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
            (enrollments || []).map(
              (item) => [
                item.student_id,
                item,
              ]
            )
          );
      }

      // --------------------------------------------------
      // BUILD RESPONSE
      // --------------------------------------------------

      const result =
        (students || []).map(
          (student) => {
            const enrollment =
              enrollmentMap.get(
                student.id
              );

            const classId =
              enrollment?.class_id ||
              null;

            return {
              id: student.id,

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

              // Class now comes from
              // student_enrollments.
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
          }
        );

      res.json(result);
    } catch (error) {
      console.error(
        "GET STUDENTS ERROR:",
        error
      );

      res.status(500).json({
        error: error.message,
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

      if (error) throw error;

      if (!student) {
        return res.status(404).json({
          error:
            "Student not found.",
        });
      }

      // --------------------------------------------------
      // GET ALL ENROLLMENTS
      // --------------------------------------------------

      const {
        data: enrollments,
        error: enrollmentError,
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

      // --------------------------------------------------
      // GET CURRENT SESSION
      // --------------------------------------------------

      const {
        data: currentSession,
        error: sessionError,
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
        (enrollments || []).find(
          (item) =>
            item.session_id ===
            currentSession?.id
        ) || null;

      // --------------------------------------------------
      // GET CURRENT CLASS
      // --------------------------------------------------

      let classRecord = null;

      if (
        currentEnrollment?.class_id
      ) {
        const {
          data,
          error: classError,
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

        classRecord = data;
      }

      // --------------------------------------------------
      // GET GUARDIANS
      // --------------------------------------------------

      const {
        data: guardians,
        error: guardianError,
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

      // --------------------------------------------------
      // GET ADMISSION RECORD
      // --------------------------------------------------

      const {
        data: admission,
        error: admissionError,
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
          classRecord || null,

        enrollment:
          currentEnrollment,

        enrollments:
          enrollments || [],

        guardians:
          guardians || [],

        admission:
          admission || null,
      });
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
// CREATE NEW STUDENT
// ======================================================

app.post(
  "/api/students",
  async (req, res) => {
    try {
      const {
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        age,
        placeOfBirth,
        nationality,
        stateOfOrigin,
        hometown,
        lga,
        religion,
        denomination,

        parentName,
        parentRelationship,
        parentPhone,
        parentEmail,
        address,

        secondaryParentName,
        secondaryParentPhone,

        emergencyContactName,
        emergencyContactPhone,

        previousSchool,
        medicalInformation,
        notes,

        classId,
        className,

        studentType,
        admissionDate,

        guardian,
        admission,
      } = req.body;

      // --------------------------------------------------
      // VALIDATION
      // --------------------------------------------------

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

      if (!gender) {
        return res.status(400).json({
          error:
            "Gender is required.",
        });
      }

      let selectedClassId =
        classId || null;

      // --------------------------------------------------
      // RESOLVE CLASS
      // --------------------------------------------------

      if (!selectedClassId && className) {
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

      // Verify class exists.
      const {
        data: classRecord,
        error: classError,
      } = await supabase
        .from("classes")
        .select("id, name")
        .eq(
          "id",
          selectedClassId
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

      // --------------------------------------------------
      // CURRENT ACADEMIC SESSION
      // --------------------------------------------------

      const {
        data: currentSession,
        error: sessionError,
      } = await supabase
        .from("academic_sessions")
        .select("id")
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!currentSession) {
        return res.status(400).json({
          error:
            "No active academic session is configured.",
        });
      }

      // --------------------------------------------------
      // CURRENT TERM
      // --------------------------------------------------

      const {
        data: currentTerm,
        error: termError,
      } = await supabase
        .from("terms")
        .select("id")
        .eq(
          "academic_session_id",
          currentSession.id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

      if (termError) {
        throw termError;
      }

      if (!currentTerm) {
        return res.status(400).json({
          error:
            "No active term is configured.",
        });
      }

      // --------------------------------------------------
      // GENERATE ADMISSION NUMBER
      // --------------------------------------------------

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

      // --------------------------------------------------
      // CREATE STUDENT PROFILE
      // --------------------------------------------------
      // IMPORTANT:
      // There is NO class_id here.
      // Class belongs to student_enrollments.

      const {
        data: student,
        error: studentError,
      } = await supabase
        .from("students")
        .insert({
          admission_no:
            admissionNo,

          first_name:
            firstName.trim(),

          middle_name:
            middleName?.trim() ||
            null,

          last_name:
            lastName.trim(),

          gender,

          status:
            "Active",

          student_type:
            studentType === "new"
              ? "new"
              : "returning",

          date_of_birth:
            dateOfBirth ||
            null,

          age:
            age !== "" &&
            age !== null &&
            age !== undefined
              ? Number(age)
              : null,

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

          admission_date:
            admissionDate ||
            new Date()
              .toISOString()
              .slice(0, 10),
        })
        .select()
        .single();

      if (studentError) {
        throw studentError;
      }

      // --------------------------------------------------
      // CREATE ENROLLMENT
      // --------------------------------------------------

      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .insert({
          student_id:
            student.id,

          session_id:
            currentSession.id,

          term_id:
            currentTerm.id,

          class_id:
            selectedClassId,

          status:
            "active",
        })
        .select()
        .single();

      if (enrollmentError) {
        // Remove the student if enrollment
        // creation fails.
        await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            student.id
          );

        throw enrollmentError;
      }

      // --------------------------------------------------
      // CREATE GUARDIAN
      // --------------------------------------------------

      if (
        guardian?.fullName?.trim()
      ) {
        const {
          error: guardianError,
        } = await supabase
          .from("guardians")
          .insert({
            student_id:
              student.id,

            full_name:
              guardian.fullName.trim(),

            relationship:
              guardian.relationship?.trim() ||
              parentRelationship?.trim() ||
              null,

            residential_address:
              guardian.residentialAddress?.trim() ||
              address?.trim() ||
              null,

            contact_address:
              guardian.contactAddress?.trim() ||
              null,

            nationality:
              guardian.nationality?.trim() ||
              nationality?.trim() ||
              null,

            state:
              guardian.state?.trim() ||
              stateOfOrigin?.trim() ||
              null,

            occupation:
              guardian.occupation?.trim() ||
              null,

            religion:
              guardian.religion?.trim() ||
              religion?.trim() ||
              null,

            denomination:
              guardian.denomination?.trim() ||
              denomination?.trim() ||
              null,

            date_of_birth:
              guardian.dateOfBirth ||
              null,

            marriage_anniversary:
              guardian.marriageAnniversary ||
              null,

            medical_declaration:
              guardian.medicalDeclaration?.trim() ||
              medicalInformation?.trim() ||
              null,

            is_primary:
              true,
          });

        if (guardianError) {
          console.error(
            "GUARDIAN CREATE ERROR:",
            guardianError
          );
        }
      }

      // --------------------------------------------------
      // CREATE ADMISSION RECORD
      // --------------------------------------------------

      if (admission) {
        const {
          error: admissionError,
        } = await supabase
          .from("admissions")
          .insert({
            student_id:
              student.id,

            admission_status:
              admission.admissionStatus ||
              "Pending",

            parent_declaration:
              admission.parentDeclaration?.trim() ||
              null,

            parent_signature_name:
              admission.parentSignatureName?.trim() ||
              null,

            declaration_date:
              admission.declarationDate ||
              null,

            school_authorized_by:
              admission.schoolAuthorizedBy?.trim() ||
              null,

            school_signature_name:
              admission.schoolSignatureName?.trim() ||
              null,
          });

        if (admissionError) {
          console.error(
            "ADMISSION CREATE ERROR:",
            admissionError
          );
        }
      }

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      res.status(201).json({
        message:
          "Student created successfully.",

        studentNumber:
          student.admission_no,

        student,

        enrollment,
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
// RETURNING STUDENT
// ======================================================

app.post(
  "/api/students/returning",
  async (req, res) => {
    try {
      const {
        studentId,
        admissionNo,

        firstName,
        middleName,
        lastName,

        gender,
        dateOfBirth,
        age,
        parentName,
        parentRelationship,
        parentPhone,
        parentEmail,
        address,

        classId,
        className,

        guardian,
      } = req.body;

      // --------------------------------------------------
      // IDENTIFICATION
      // --------------------------------------------------

      if (
        !studentId &&
        !admissionNo
      ) {
        return res.status(400).json({
          error:
            "Student ID or admission number is required.",
        });
      }

      // --------------------------------------------------
      // FIND EXISTING STUDENT
      // --------------------------------------------------

      let studentQuery =
        supabase
          .from("students")
          .select("*");

      if (studentId) {
        studentQuery =
          studentQuery.eq(
            "id",
            studentId
          );
      } else {
        studentQuery =
          studentQuery.eq(
            "admission_no",
            admissionNo
          );
      }

      const {
        data: existingStudent,
        error: findError,
      } = await studentQuery
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!existingStudent) {
        return res.status(404).json({
          error:
            "Existing student was not found.",
        });
      }

      // --------------------------------------------------
      // RESOLVE CLASS
      // --------------------------------------------------

      let selectedClassId =
        classId || null;

      if (
        !selectedClassId &&
        className
      ) {
        const {
          data: classRecord,
          error: classError,
        } = await supabase
          .from("classes")
          .select("id")
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

      // Verify class.
      const {
        data: classRecord,
        error: classError,
      } = await supabase
        .from("classes")
        .select("id, name")
        .eq(
          "id",
          selectedClassId
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

      // --------------------------------------------------
      // CURRENT SESSION
      // --------------------------------------------------

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

      if (!currentSession) {
        return res.status(400).json({
          error:
            "No active academic session is configured.",
        });
      }

      // --------------------------------------------------
      // CURRENT TERM
      // --------------------------------------------------

      const {
        data: currentTerm,
        error: termError,
      } = await supabase
        .from("terms")
        .select("id")
        .eq(
          "academic_session_id",
          currentSession.id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

      if (termError) {
        throw termError;
      }

      if (!currentTerm) {
        return res.status(400).json({
          error:
            "No active term is configured.",
        });
      }

      // --------------------------------------------------
      // UPDATE EXISTING STUDENT
      // --------------------------------------------------
      // Admission number is deliberately NOT changed.

      const {
        data: updatedStudent,
        error: updateError,
      } = await supabase
        .from("students")
        .update({
          first_name:
            firstName?.trim() ||
            existingStudent.first_name,

          middle_name:
            middleName?.trim() ||
            existingStudent.middle_name ||
            null,

          last_name:
            lastName?.trim() ||
            existingStudent.last_name,

          gender:
            gender ||
            existingStudent.gender,

          status:
            "Active",

          student_type:
            "returning",

          date_of_birth:
            dateOfBirth ||
            existingStudent.date_of_birth ||
            null,

          age:
            age !== "" &&
            age !== null &&
            age !== undefined
              ? Number(age)
              : existingStudent.age,

          parent_name:
            parentName?.trim() ||
            existingStudent.parent_name ||
            null,

          parent_relationship:
            parentRelationship?.trim() ||
            existingStudent.parent_relationship ||
            null,

          parent_phone:
            parentPhone?.trim() ||
            existingStudent.parent_phone ||
            null,

          parent_email:
            parentEmail?.trim() ||
            existingStudent.parent_email ||
            null,

          address:
            address?.trim() ||
            existingStudent.address ||
            null,
        })
        .eq(
          "id",
          existingStudent.id
        )
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // --------------------------------------------------
      // CREATE OR UPDATE ENROLLMENT
      // --------------------------------------------------

      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from(
          "student_enrollments"
        )
        .upsert(
          {
            student_id:
              existingStudent.id,

            session_id:
              currentSession.id,

            term_id:
              currentTerm.id,

            class_id:
              selectedClassId,

            status:
              "active",
          },
          {
            onConflict:
              "student_id,session_id",
          }
        )
        .select()
        .single();

      if (enrollmentError) {
        throw enrollmentError;
      }

      // --------------------------------------------------
      // OPTIONAL GUARDIAN UPDATE
      // --------------------------------------------------

      if (
        guardian?.fullName?.trim()
      ) {
        const {
          error: guardianError,
        } = await supabase
          .from("guardians")
          .upsert(
            {
              student_id:
                existingStudent.id,

              full_name:
                guardian.fullName.trim(),

              relationship:
                guardian.relationship?.trim() ||
                parentRelationship?.trim() ||
                null,

              residential_address:
                guardian.residentialAddress?.trim() ||
                address?.trim() ||
                null,

              contact_address:
                guardian.contactAddress?.trim() ||
                null,

              nationality:
                guardian.nationality?.trim() ||
                null,

              state:
                guardian.state?.trim() ||
                null,

              occupation:
                guardian.occupation?.trim() ||
                null,

              religion:
                guardian.religion?.trim() ||
                null,

              denomination:
                guardian.denomination?.trim() ||
                null,

              date_of_birth:
                guardian.dateOfBirth ||
                null,

              is_primary:
                true,
            },
            {
              onConflict:
                "student_id,is_primary",
            }
          );

        if (guardianError) {
          console.error(
            "RETURNING GUARDIAN ERROR:",
            guardianError
          );
        }
      }

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      res.status(200).json({
        message:
          "Returning student enrolled successfully.",

        studentNumber:
          updatedStudent.admission_no,

        student:
          updatedStudent,

        enrollment,
      });

    } catch (error) {
      console.error(
        "RETURNING STUDENT ERROR:",
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
        .from("academic_sessions")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        return res.status(404).json({
          error:
            "No active academic session found.",
        });
      }

      const {
        data: term,
        error: termError,
      } = await supabase
        .from("terms")
        .select("*")
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
        term:
          term || null,
      });

    } catch (error) {
      console.error(
        "CURRENT ACADEMIC ERROR:",
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
        typeof attendance !== "object"
      ) {
        return res.status(400).json({
          error:
            "Attendance data is required.",
        });
      }

      const studentIds =
        Object.keys(attendance);

      if (
        studentIds.length === 0
      ) {
        return res.status(400).json({
          error:
            "No attendance records were supplied.",
        });
      }

      // --------------------------------------------------
      // CURRENT SESSION
      // --------------------------------------------------

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

      if (!currentSession) {
        return res.status(400).json({
          error:
            "No active academic session is configured.",
        });
      }

      // --------------------------------------------------
      // CURRENT ENROLLMENTS
      // --------------------------------------------------

      const {
        data: enrollments,
        error: enrollmentError,
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
          "session_id",
          currentSession.id
        )
        .in(
          "student_id",
          studentIds
        );

      if (enrollmentError) {
        throw enrollmentError;
      }

      const enrollmentMap =
        new Map(
          (enrollments || []).map(
            (enrollment) => [
              enrollment.student_id,
              enrollment,
            ]
          )
        );

      // --------------------------------------------------
      // BUILD ATTENDANCE RECORDS
      // --------------------------------------------------

      const records =
        Object.entries(
          attendance
        ).map(
          ([
            studentId,
            status,
          ]) => {
            const enrollment =
              enrollmentMap.get(
                studentId
              );

            return {
              student_id:
                studentId,

              enrollment_id:
                enrollment?.id ||
                null,

              attendance_date:
                date,

              status,
            };
          }
        );

      // --------------------------------------------------
      // CHECK ENROLLMENTS
      // --------------------------------------------------

      const missingEnrollment =
        records.find(
          (record) =>
            !record.enrollment_id
        );

      if (
        missingEnrollment
      ) {
        return res.status(400).json({
          error:
            "One or more students do not have an enrollment for the current academic session.",

          studentId:
            missingEnrollment.student_id,
        });
      }

      // --------------------------------------------------
      // SAVE
      // --------------------------------------------------

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
        error:
          error.message,
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
      const {
        date,
        classId,
      } = req.query;

      let query = supabase
        .from(
          "student_attendance"
        )
        .select(`
          id,
          student_id,
          enrollment_id,
          attendance_date,
          status
        `)
        .order(
          "attendance_date",
          {
            ascending: false,
          }
        );

      if (date) {
        query =
          query.eq(
            "attendance_date",
            date
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      let result =
        data || [];

      // If a class was supplied, filter
      // through student enrollments.
      if (classId) {
        const {
          data: enrollments,
          error: enrollmentError,
        } = await supabase
          .from(
            "student_enrollments"
          )
          .select(
            "id, class_id"
          )
          .eq(
            "class_id",
            classId
          );

        if (enrollmentError) {
          throw enrollmentError;
        }

        const enrollmentIds =
          new Set(
            (enrollments || []).map(
              (item) =>
                item.id
            )
          );

        result =
          result.filter(
            (item) =>
              enrollmentIds.has(
                item.enrollment_id
              )
          );
      }

      res.json(result);

    } catch (error) {
      console.error(
        "GET ATTENDANCE ERROR:",
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
        .from("fee_accounts")
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
        error:
          error.message,
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
  }
);
