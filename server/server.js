const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ========================================
// AIRTABLE CONFIGURATION
// ========================================

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const AIRTABLE_STUDENTS_TABLE =
  process.env.AIRTABLE_STUDENTS_TABLE || "Students";

const AIRTABLE_FEES_TABLE =
  process.env.AIRTABLE_FEES_TABLE || "Fee Accounts";

const AIRTABLE_ATTENDANCE_TABLE =
  process.env.AIRTABLE_ATTENDANCE_TABLE || "Attendance";

// ========================================
// AIRTABLE URLS
// ========================================

const airtableUrl =
  `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/` +
  `${encodeURIComponent(AIRTABLE_STUDENTS_TABLE)}`;

const feesAirtableUrl =
  `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/` +
  `${encodeURIComponent(AIRTABLE_FEES_TABLE)}`;

const attendanceAirtableUrl =
  `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/` +
  `${encodeURIComponent(AIRTABLE_ATTENDANCE_TABLE)}`;

// ========================================
// AIRTABLE HEADERS
// ========================================

const airtableHeaders = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

// ========================================
// VALID SCHOOL CLASSES
// ========================================

const validClasses = [
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

// ========================================
// VALID ATTENDANCE STATUSES
// ========================================

const validAttendanceStatuses = [
  "Present",
  "Absent",
  "Late",
  "Excused",
];

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    message: "Predvic School Portal API is running",
    status: "OK",
  });
});

// ========================================
// GET STUDENTS
// ========================================

app.get("/api/students", async (req, res) => {
  try {
    const response = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Unable to load students.",
      });
    }

    const students = (data.records || []).map(
      (record) => {
        const fields = record.fields || {};

        return {
          id: record.id,

          studentId:
            fields["Student ID Auto"] || "",

          firstName:
            fields["First Name"] || "",

          lastName:
            fields["Last Name"] || "",

          fullName:
            fields["Name"] ||
            [
              fields["First Name"],
              fields["Last Name"],
            ]
              .filter(Boolean)
              .join(" "),

          className:
            fields["Class"] || "",

          studentNumber:
            fields["Student Number"] || "",

          parentPhone:
            fields["Parent Phone"] || "",

          status:
            fields["Status"] || "Active",
        };
      }
    );

    res.json(students);
  } catch (error) {
    console.error(
      "GET students error:",
      error
    );

    res.status(500).json({
      error: "Unable to load students.",
    });
  }
});

// ========================================
// CREATE STUDENT
// ========================================

app.post("/api/students", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      parentPhone,
      className,
      status,
    } = req.body;

    if (
      !firstName ||
      !String(firstName).trim()
    ) {
      return res.status(400).json({
        error: "First name is required.",
      });
    }

    if (
      !lastName ||
      !String(lastName).trim()
    ) {
      return res.status(400).json({
        error: "Last name is required.",
      });
    }

    if (
      !className ||
      !validClasses.includes(className)
    ) {
      return res.status(400).json({
        error: "Please select a valid class.",
      });
    }

    const cleanFirstName =
      String(firstName).trim();

    const cleanLastName =
      String(lastName).trim();

    // ====================================
    // IMPORTANT:
    // Populate Airtable's primary Name
    // field so linked records show
    // the student's actual name.
    // ====================================

    const fields = {
      Name:
        `${cleanFirstName} ${cleanLastName}`,

      "First Name":
        cleanFirstName,

      "Last Name":
        cleanLastName,

      Class: className,

      Status:
        status || "Active",
    };

    if (
      parentPhone &&
      String(parentPhone).trim()
    ) {
      fields["Parent Phone"] =
        String(parentPhone).trim();
    }

    const response = await fetch(
      airtableUrl,
      {
        method: "POST",
        headers: airtableHeaders,

        body: JSON.stringify({
          fields,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "CREATE student error:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res.status(
        response.status
      ).json({
        error:
          data?.error?.message ||
          "Unable to create student.",
      });
    }

    console.log(
      `Student created: ${cleanFirstName} ${cleanLastName}`
    );

    res.status(201).json(data);
  } catch (error) {
    console.error(
      "CREATE STUDENT error:",
      error
    );

    res.status(500).json({
      error:
        "Unable to create student.",
    });
  }
});

// ========================================
// GET ATTENDANCE
// ========================================

app.get(
  "/api/attendance",
  async (req, res) => {
    try {
      const response =
        await fetch(
          attendanceAirtableUrl,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return res.status(
          response.status
        ).json({
          error:
            data?.error?.message ||
            "Unable to load attendance.",
        });
      }

      res.json(
        data.records || []
      );
    } catch (error) {
      console.error(
        "GET attendance error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load attendance.",
      });
    }
  }
);

// ========================================
// SAVE STUDENT ATTENDANCE
// ========================================

app.post(
  "/api/attendance",
  async (req, res) => {
    try {
      const {
        date,
        className,
        attendance,
        recordedBy,
      } = req.body;

      // ====================================
      // VALIDATION
      // ====================================

      if (!date) {
        return res.status(400).json({
          error:
            "Attendance date is required.",
        });
      }

      if (
        !className ||
        !validClasses.includes(className)
      ) {
        return res.status(400).json({
          error:
            "Please select a valid class.",
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

      if (studentIds.length === 0) {
        return res.status(400).json({
          error:
            "No attendance records were provided.",
        });
      }

      // ====================================
      // LOAD STUDENTS
      // ====================================

      const studentResponse =
        await fetch(
          airtableUrl,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const studentData =
        await studentResponse.json();

      if (!studentResponse.ok) {
        return res.status(500).json({
          error:
            "Unable to verify students.",
        });
      }

      const studentRecords =
        studentData.records || [];

      const studentMap =
        new Map(
          studentRecords.map(
            (student) => [
              student.id,
              student,
            ]
          )
        );

      // ====================================
      // VERIFY CLASS + STATUS
      // ====================================

      for (const studentId of studentIds) {
        const student =
          studentMap.get(
            studentId
          );

        if (!student) {
          return res.status(400).json({
            error:
              `Student ${studentId} could not be found.`,
          });
        }

        const studentClass =
          student.fields?.Class;

        if (
          studentClass !== className
        ) {
          return res.status(400).json({
            error:
              `Student does not belong to ${className}.`,
          });
        }

        if (
          !validAttendanceStatuses.includes(
            attendance[studentId]
          )
        ) {
          return res.status(400).json({
            error:
              `Invalid attendance status for ${studentId}.`,
          });
        }
      }

      // ====================================
      // LOAD EXISTING ATTENDANCE
      // ====================================

      const existingResponse =
        await fetch(
          attendanceAirtableUrl,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const existingData =
        await existingResponse.json();

      if (!existingResponse.ok) {
        return res.status(500).json({
          error:
            "Unable to check existing attendance.",
        });
      }

      const existingRecords =
        existingData.records || [];

      // ====================================
      // FIND EXISTING RECORDS
      //
      // ONE STUDENT + ONE DATE
      // = ONE ATTENDANCE RECORD
      // ====================================

      const existingMap =
        new Map();

      existingRecords.forEach(
        (record) => {
          const fields =
            record.fields || {};

          const studentLinks =
            fields.Student || [];

          const recordDate =
            fields.Date;

          if (
            studentLinks.length > 0 &&
            recordDate
          ) {
            const key =
              `${studentLinks[0]}_${recordDate}`;

            existingMap.set(
              key,
              record
            );
          }
        }
      );

      const recordsToCreate = [];
      const recordsToUpdate = [];

      // ====================================
      // CREATE OR UPDATE
      // ====================================

      for (const studentId of studentIds) {
        const key =
          `${studentId}_${date}`;

        const existingRecord =
          existingMap.get(key);

        if (existingRecord) {
          recordsToUpdate.push({
            id: existingRecord.id,

            fields: {
              Status:
                attendance[
                  studentId
                ],

              "Recorded By":
                recordedBy ||
                "School Admin",
            },
          });
        } else {
          recordsToCreate.push({
            fields: {
              "Attendance ID":
                `ATT-${date}-${studentId}`,

              Student: [
                studentId,
              ],

              Date: date,

              Status:
                attendance[
                  studentId
                ],

              "Recorded By":
                recordedBy ||
                "School Admin",
            },
          });
        }
      }

      // ====================================
      // CREATE NEW RECORDS
      // ====================================

      const createdRecords = [];

      for (
        let i = 0;
        i < recordsToCreate.length;
        i += 50
      ) {
        const batch =
          recordsToCreate.slice(
            i,
            i + 50
          );

        const response =
          await fetch(
            attendanceAirtableUrl,
            {
              method: "POST",

              headers:
                airtableHeaders,

              body: JSON.stringify({
                records: batch,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            "CREATE attendance error:",
            JSON.stringify(
              data,
              null,
              2
            )
          );

          return res.status(
            response.status
          ).json({
            error:
              data?.error?.message ||
              "Unable to create attendance.",
          });
        }

        createdRecords.push(
          ...(data.records || [])
        );
      }

      // ====================================
      // UPDATE EXISTING RECORDS
      // ====================================

      const updatedRecords = [];

      for (
        let i = 0;
        i < recordsToUpdate.length;
        i += 50
      ) {
        const batch =
          recordsToUpdate.slice(
            i,
            i + 50
          );

        const response =
          await fetch(
            attendanceAirtableUrl,
            {
              method: "PATCH",

              headers:
                airtableHeaders,

              body: JSON.stringify({
                records: batch,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            "UPDATE attendance error:",
            JSON.stringify(
              data,
              null,
              2
            )
          );

          return res.status(
            response.status
          ).json({
            error:
              data?.error?.message ||
              "Unable to update attendance.",
          });
        }

        updatedRecords.push(
          ...(data.records || [])
        );
      }

      // ====================================
      // SUCCESS
      // ====================================

      console.log(
        `Attendance saved for ${studentIds.length} student(s) in ${className} on ${date}.`
      );

      res.status(201).json({
        message:
          "Attendance saved successfully.",

        date,

        className,

        created:
          createdRecords.length,

        updated:
          updatedRecords.length,

        recordsProcessed:
          studentIds.length,
      });
    } catch (error) {
      console.error(
        "SAVE ATTENDANCE error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to save attendance.",
      });
    }
  }
);

// ========================================
// GET FEE ACCOUNTS
// ========================================

app.get(
  "/api/fee-accounts",
  async (req, res) => {
    try {
      const response =
        await fetch(
          feesAirtableUrl,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return res.status(
          response.status
        ).json({
          error:
            data?.error?.message ||
            "Unable to load fee accounts.",
        });
      }

      res.json(
        data.records || []
      );
    } catch (error) {
      console.error(
        "GET fee accounts error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load fee accounts.",
      });
    }
  }
);

// ========================================
// CREATE FEE ACCOUNT
// ========================================

app.post(
  "/api/fee-accounts",
  async (req, res) => {
    try {
      const {
        studentRecordId,
        session,
        term,
        totalFee,
      } = req.body;

      if (!studentRecordId) {
        return res.status(400).json({
          error:
            "Student is required.",
        });
      }

      if (
        !session ||
        !String(session).trim()
      ) {
        return res.status(400).json({
          error:
            "Session is required.",
        });
      }

      if (
        !term ||
        !String(term).trim()
      ) {
        return res.status(400).json({
          error:
            "Term is required.",
        });
      }

      const feeAmount =
        Number(totalFee);

      if (
        !Number.isFinite(
          feeAmount
        ) ||
        feeAmount <= 0
      ) {
        return res.status(400).json({
          error:
            "Enter a valid total fee.",
        });
      }

      // VERIFY STUDENT

      const studentResponse =
        await fetch(
          `${airtableUrl}/${studentRecordId}`,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const studentData =
        await studentResponse.json();

      if (!studentResponse.ok) {
        return res.status(400).json({
          error:
            "The selected student could not be found.",
        });
      }

      // GET EXISTING FEE IDS

      const existingResponse =
        await fetch(
          feesAirtableUrl,
          {
            headers: {
              Authorization:
                `Bearer ${AIRTABLE_TOKEN}`,
            },
          }
        );

      const existingData =
        await existingResponse.json();

      if (!existingResponse.ok) {
        return res.status(500).json({
          error:
            "Unable to generate fee account ID.",
        });
      }

      const existingIds =
        (existingData.records || [])
          .map(
            (record) =>
              record.fields?.[
                "Fee Account ID"
              ]
          )
          .filter(Boolean);

      let highestNumber = 0;

      for (const id of existingIds) {
        const match =
          String(id).match(
            /^Fe(\d+)$/i
          );

        if (match) {
          const number =
            Number(match[1]);

          if (
            number >
            highestNumber
          ) {
            highestNumber =
              number;
          }
        }
      }

      const feeAccountId =
        `Fe${String(
          highestNumber + 1
        ).padStart(3, "0")}`;

      const fields = {
        "Fee Account ID":
          feeAccountId,

        Student: [
          studentRecordId,
        ],

        Session:
          String(session).trim(),

        Term:
          String(term).trim(),

        "Total Fee":
          feeAmount,
      };

      const response =
        await fetch(
          feesAirtableUrl,
          {
            method: "POST",

            headers:
              airtableHeaders,

            body: JSON.stringify({
              fields,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return res.status(
          response.status
        ).json({
          error:
            data?.error?.message ||
            "Unable to create fee account.",
        });
      }

      res.status(201).json(data);
    } catch (error) {
      console.error(
        "CREATE FEE ACCOUNT error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to create fee account.",
      });
    }
  }
);

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(
    `Predvic School Portal API running on http://localhost:${PORT}`
  );
});