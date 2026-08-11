const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_STUDENTS_TABLE =
  process.env.AIRTABLE_STUDENTS_TABLE || "Students";

const airtableUrl =
  `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/` +
  `${encodeURIComponent(AIRTABLE_STUDENTS_TABLE)}`;

const airtableHeaders = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};


// ===============================
// TEST
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "Predvic School Portal API is running",
  });
});


// ===============================
// GET STUDENTS
// ===============================

app.get("/api/students", async (req, res) => {
  try {
    const response = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Airtable GET error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Unable to load students.",
      });
    }

    res.json(data.records || []);
  } catch (error) {
    console.error("GET students error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});


// ===============================
// CREATE STUDENT
// ===============================

app.post("/api/students", async (req, res) => {
  try {
    const {
      name,
      parentPhone,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Student name is required.",
      });
    }

    const fields = {
      Name: String(name).trim(),
      Status: status || "Active",
    };

    if (parentPhone && parentPhone.trim()) {
      fields["Parent Phone"] = parentPhone.trim();
    }

    console.log("Creating student:", fields);

    const response = await fetch(airtableUrl, {
      method: "POST",
      headers: airtableHeaders,
      body: JSON.stringify({
        fields,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Airtable CREATE error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Unable to create student.",
      });
    }

    console.log(
      "Student created:",
      data.id
    );

    res.status(201).json(data);

  } catch (error) {
    console.error(
      "CREATE STUDENT error:",
      error
    );

    res.status(500).json({
      error: error.message,
    });
  }
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(
    `Predvic School Portal API running on http://localhost:${PORT}`
  );
});