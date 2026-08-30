import { useEffect, useState } from "react";

const API_URL = "https://predivic-school-fees-portal.onrender.com";

const EMPTY_NEW_STUDENT = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  age: "",
  placeOfBirth: "",
  nationality: "",
  stateOfOrigin: "",
  hometown: "",
  lga: "",
  religion: "",
  denomination: "",

  classId: "",
  className: "",

  studentType: "new",
  admissionDate: "",

  parentName: "",
  parentRelationship: "",
  parentPhone: "",
  parentEmail: "",
  address: "",

  secondaryParentName: "",
  secondaryParentPhone: "",

  emergencyContactName: "",
  emergencyContactPhone: "",

  previousSchool: "",
  medicalInformation: "",
  notes: "",

  guardian: {
    fullName: "",
    relationship: "",
    residentialAddress: "",
    contactAddress: "",
    nationality: "",
    state: "",
    occupation: "",
    religion: "",
    denomination: "",
    dateOfBirth: "",
    marriageAnniversary: "",
    medicalDeclaration: "",
  },

  admission: {
    admissionStatus: "Pending",
    parentDeclaration: "",
    parentSignatureName: "",
    declarationDate: "",
    schoolAuthorizedBy: "",
    schoolSignatureName: "",
  },
};

const EMPTY_RETURNING_STUDENT = {
  admissionNo: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  parentPhone: "",
  classId: "",
  className: "",
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [registrationType, setRegistrationType] =
    useState("new");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newStudent, setNewStudent] =
    useState(EMPTY_NEW_STUDENT);

  const [returningStudent, setReturningStudent] =
    useState(EMPTY_RETURNING_STUDENT);

  const [returningMatches, setReturningMatches] =
    useState([]);

  const [selectedReturningStudent, setSelectedReturningStudent] =
    useState(null);

  const [searchingReturning, setSearchingReturning] =
    useState(false);

  // ==================================================
  // LOAD STUDENTS
  // ==================================================

  const fetchStudents = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/students`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load students."
        );
      }

      setStudents(data);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load students."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // LOAD CLASSES
  // ==================================================

  const fetchClasses = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/classes`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load classes."
        );
      }

      setClasses(data);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load classes."
      );
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  // ==================================================
  // NEW STUDENT CHANGE
  // ==================================================

  const handleNewStudentChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setNewStudent((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // ==================================================
  // RETURNING STUDENT CHANGE
  // ==================================================

  const handleReturningStudentChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setReturningStudent((current) => ({
      ...current,
      [name]: value,
    }));

    // If the user changes search information,
    // the previous selection is no longer trusted.
    setSelectedReturningStudent(null);
    setReturningMatches([]);
    setError("");
  };

  // ==================================================
  // GUARDIAN CHANGE
  // ==================================================

  const handleGuardianChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setNewStudent((current) => ({
      ...current,

      guardian: {
        ...current.guardian,
        [name]: value,
      },
    }));
  };

  // ==================================================
  // ADMISSION CHANGE
  // ==================================================

  const handleAdmissionChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setNewStudent((current) => ({
      ...current,

      admission: {
        ...current.admission,
        [name]: value,
      },
    }));
  };

  // ==================================================
  // NEW STUDENT CLASS
  // ==================================================

  const handleNewStudentClassChange = (event) => {
    const classId = event.target.value;

    const selectedClass = classes.find(
      (item) =>
        String(item.id) ===
        String(classId)
    );

    setNewStudent((current) => ({
      ...current,
      classId,
      className:
        selectedClass?.name || "",
    }));
  };

  // ==================================================
  // RETURNING STUDENT CLASS
  // ==================================================

  const handleReturningClassChange = (event) => {
    const classId = event.target.value;

    const selectedClass = classes.find(
      (item) =>
        String(item.id) ===
        String(classId)
    );

    setReturningStudent((current) => ({
      ...current,
      classId,
      className:
        selectedClass?.name || "",
    }));
  };

  // ==================================================
  // SUBMIT NEW STUDENT
  // ==================================================

  const submitNewStudent = async () => {
    const form = newStudent;

    if (!form.firstName.trim()) {
      setError(
        "First name is required."
      );
      return;
    }

    if (!form.lastName.trim()) {
      setError(
        "Last name is required."
      );
      return;
    }

    if (!form.gender) {
      setError(
        "Gender is required."
      );
      return;
    }

    if (!form.classId) {
      setError(
        "Please select a class."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/students`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            firstName:
              form.firstName.trim(),

            middleName:
              form.middleName.trim(),

            lastName:
              form.lastName.trim(),

            gender:
              form.gender,

            dateOfBirth:
              form.dateOfBirth ||
              null,

            age:
              form.age,

            placeOfBirth:
              form.placeOfBirth.trim(),

            nationality:
              form.nationality.trim(),

            stateOfOrigin:
              form.stateOfOrigin.trim(),

            hometown:
              form.hometown.trim(),

            lga:
              form.lga.trim(),

            religion:
              form.religion.trim(),

            denomination:
              form.denomination.trim(),

            classId:
              form.classId,

            className:
              form.className,

            studentType:
              "new",

            admissionDate:
              form.admissionDate ||
              null,

            parentName:
              form.parentName.trim(),

            parentRelationship:
              form.parentRelationship.trim(),

            parentPhone:
              form.parentPhone.trim(),

            parentEmail:
              form.parentEmail.trim(),

            address:
              form.address.trim(),

            secondaryParentName:
              form.secondaryParentName.trim(),

            secondaryParentPhone:
              form.secondaryParentPhone.trim(),

            emergencyContactName:
              form.emergencyContactName.trim(),

            emergencyContactPhone:
              form.emergencyContactPhone.trim(),

            previousSchool:
              form.previousSchool.trim(),

            medicalInformation:
              form.medicalInformation.trim(),

            notes:
              form.notes.trim(),

            guardian: {
              fullName:
                form.guardian.fullName.trim(),

              relationship:
                form.guardian.relationship.trim(),

              residentialAddress:
                form.guardian.residentialAddress.trim(),

              contactAddress:
                form.guardian.contactAddress.trim(),

              nationality:
                form.guardian.nationality.trim(),

              state:
                form.guardian.state.trim(),

              occupation:
                form.guardian.occupation.trim(),

              religion:
                form.guardian.religion.trim(),

              denomination:
                form.guardian.denomination.trim(),

              dateOfBirth:
                form.guardian.dateOfBirth ||
                null,

              marriageAnniversary:
                form.guardian
                  .marriageAnniversary ||
                null,

              medicalDeclaration:
                form.guardian
                  .medicalDeclaration
                  .trim(),
            },

            admission: {
              admissionStatus:
                form.admission
                  .admissionStatus,

              parentDeclaration:
                form.admission
                  .parentDeclaration
                  .trim(),

              parentSignatureName:
                form.admission
                  .parentSignatureName
                  .trim(),

              declarationDate:
                form.admission
                  .declarationDate ||
                null,

              schoolAuthorizedBy:
                form.admission
                  .schoolAuthorizedBy
                  .trim(),

              schoolSignatureName:
                form.admission
                  .schoolSignatureName
                  .trim(),
            },
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create student."
        );
      }

      setSuccess(
        `New student added successfully. Admission No: ${
          data.studentNumber ||
          data.student?.admission_no ||
          "Generated"
        }`
      );

      setNewStudent(
        EMPTY_NEW_STUDENT
      );

      setShowForm(false);

      await fetchStudents();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to create student."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==================================================
  // SEARCH RETURNING STUDENT
  // ==================================================

  const searchReturningStudents = async () => {
    const form =
      returningStudent;

    const admissionNo =
      form.admissionNo.trim();

    const firstName =
      form.firstName.trim();

    const lastName =
      form.lastName.trim();

    const parentPhone =
      form.parentPhone.trim();

    if (
      !admissionNo &&
      !firstName &&
      !lastName &&
      !form.dateOfBirth &&
      !parentPhone
    ) {
      setError(
        "Enter an admission number, name, date of birth, or parent phone number."
      );
      return;
    }

    try {
      setSearchingReturning(true);
      setError("");
      setSuccess("");

      setReturningMatches([]);
      setSelectedReturningStudent(null);

      const params =
        new URLSearchParams();

      if (admissionNo) {
        params.set(
          "admissionNo",
          admissionNo
        );
      } else {
        if (firstName) {
          params.set(
            "firstName",
            firstName
          );
        }

        if (lastName) {
          params.set(
            "lastName",
            lastName
          );
        }

        if (form.dateOfBirth) {
          params.set(
            "dateOfBirth",
            form.dateOfBirth
          );
        }

        if (parentPhone) {
          params.set(
            "parentPhone",
            parentPhone
          );
        }
      }

      const response = await fetch(
        `${API_URL}/api/returning-students/search?${params.toString()}`
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to search for student."
        );
      }

      const matches =
        Array.isArray(data)
          ? data
          : [];

      setReturningMatches(matches);

      if (matches.length === 0) {
        setError(
          "No matching existing student found."
        );
        return;
      }

      // IMPORTANT:
      // If there is exactly one match,
      // select it automatically.
      if (matches.length === 1) {
        setSelectedReturningStudent(
          matches[0]
        );

        setSuccess(
          "Existing student found and selected."
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to search for student."
      );
    } finally {
      setSearchingReturning(false);
    }
  };

  // ==================================================
  // SELECT RETURNING STUDENT
  // ==================================================

  const selectReturningStudent = (student) => {
    setSelectedReturningStudent(
      student
    );

    setError("");
    setSuccess(
      "Existing student selected."
    );
  };

  // ==================================================
  // SUBMIT RETURNING STUDENT
  // ==================================================

  const submitReturningStudent = async () => {
    if (!selectedReturningStudent) {
      setError(
        "Search for and select the existing student first."
      );
      return;
    }

    if (!returningStudent.classId) {
      setError(
        "Please select the student's current class."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/students/returning`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            studentId:
              selectedReturningStudent.id,

            classId:
              returningStudent.classId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to register returning student."
        );
      }

      setSuccess(
        data.message ||
          "Returning student registered successfully."
      );

      setReturningStudent(
        EMPTY_RETURNING_STUDENT
      );

      setReturningMatches([]);

      setSelectedReturningStudent(
        null
      );

      setShowForm(false);

      await fetchStudents();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to register returning student."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==================================================
  // FORM SUBMIT
  // ==================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      registrationType ===
      "new"
    ) {
      await submitNewStudent();
    } else {
      await submitReturningStudent();
    }
  };

  // ==================================================
  // RESET REGISTRATION FORM
  // ==================================================

  const resetRegistration = () => {
    setRegistrationType("new");

    setNewStudent(
      EMPTY_NEW_STUDENT
    );

    setReturningStudent(
      EMPTY_RETURNING_STUDENT
    );

    setReturningMatches([]);

    setSelectedReturningStudent(
      null
    );

    setError("");
    setSuccess("");
  };

  // ==================================================
  // FILTER STUDENTS
  // ==================================================

  const filteredStudents =
    students.filter((student) => {
      const query =
        search
          .toLowerCase()
          .trim();

      const name =
        student.fullName ||
        [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" ");

      const matchesSearch =
        !query ||
        name
          .toLowerCase()
          .includes(query) ||
        String(
          student.admissionNo ||
            student.admission_no ||
            ""
        )
          .toLowerCase()
          .includes(query);

      const matchesClass =
        !classFilter ||
        student.className ===
          classFilter;

      return (
        matchesSearch &&
        matchesClass
      );
    });

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="page">
        <h1>Students</h1>
        <p>
          Loading students...
        </p>
      </div>
    );
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div className="page">

      {/* HEADER */}

      <div className="page-header">

        <h1>
          Students
        </h1>

        <button
          className="primary-btn"
          onClick={() => {
            setShowForm(
              (current) =>
                !current
            );

            setError("");
            setSuccess("");
          }}
        >
          {showForm
            ? "Close"
            : "+ Add Student"}
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div
          style={{
            background:
              "#fee2e2",
            color:
              "#991b1b",
            padding:
              "12px 15px",
            borderRadius:
              "8px",
            marginBottom:
              "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div
          style={{
            background:
              "#dcfce7",
            color:
              "#166534",
            padding:
              "12px 15px",
            borderRadius:
              "8px",
            marginBottom:
              "20px",
          }}
        >
          {success}
        </div>
      )}

      {/* ==================================================
          REGISTRATION FORM
      ================================================== */}

      {showForm && (
        <div
          className="page-card"
          style={{
            marginBottom:
              "25px",
          }}
        >

          <h2>
            Student Registration
          </h2>

          {/* STUDENT TYPE */}

          <div
            style={{
              marginTop:
                "25px",
              marginBottom:
                "25px",
            }}
          >

            <label
              style={{
                display:
                  "block",
                fontWeight:
                  "600",
                marginBottom:
                  "8px",
              }}
            >
              Student Type
            </label>

            <select
              value={
                registrationType
              }
              onChange={(event) => {
                const type =
                  event.target.value;

                setRegistrationType(
                  type
                );

                setError("");
                setSuccess("");

                if (
                  type ===
                  "returning"
                ) {
                  setReturningStudent(
                    EMPTY_RETURNING_STUDENT
                  );

                  setReturningMatches(
                    []
                  );

                  setSelectedReturningStudent(
                    null
                  );
                }
              }}
              className="filter-select"
              style={{
                width:
                  "100%",
                maxWidth:
                  "400px",
              }}
            >

              <option value="new">
                New Student
              </option>

              <option value="returning">
                Returning Student
              </option>

            </select>

          </div>

          <form
            onSubmit={
              handleSubmit
            }
          >

            {/* ==================================================
                NEW STUDENT
            ================================================== */}

            {registrationType ===
              "new" && (
              <>

                <h3
                  style={{
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Student Information
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <input
                    type="text"
                    name="firstName"
                    placeholder="First name *"
                    value={
                      newStudent.firstName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="middleName"
                    placeholder="Middle name"
                    value={
                      newStudent.middleName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last name *"
                    value={
                      newStudent.lastName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <select
                    name="gender"
                    value={
                      newStudent.gender
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="filter-select"
                  >
                    <option value="">
                      Select Gender *
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>
                  </select>

                  <input
                    type="date"
                    name="dateOfBirth"
                    value={
                      newStudent.dateOfBirth
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="number"
                    name="age"
                    placeholder="Age"
                    value={
                      newStudent.age
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="placeOfBirth"
                    placeholder="Place of birth"
                    value={
                      newStudent.placeOfBirth
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="nationality"
                    placeholder="Nationality"
                    value={
                      newStudent.nationality
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="stateOfOrigin"
                    placeholder="State of origin"
                    value={
                      newStudent.stateOfOrigin
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="hometown"
                    placeholder="Hometown"
                    value={
                      newStudent.hometown
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="lga"
                    placeholder="LGA"
                    value={
                      newStudent.lga
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="religion"
                    placeholder="Religion"
                    value={
                      newStudent.religion
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="denomination"
                    placeholder="Denomination"
                    value={
                      newStudent.denomination
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <select
                    value={
                      newStudent.classId
                    }
                    onChange={
                      handleNewStudentClassChange
                    }
                    className="filter-select"
                  >
                    <option value="">
                      Select Class *
                    </option>

                    {classes.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.name}
                        </option>
                      )
                    )}
                  </select>

                  <input
                    type="date"
                    name="admissionDate"
                    value={
                      newStudent.admissionDate
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                </div>

                {/* PARENT */}

                <h3
                  style={{
                    marginTop:
                      "35px",
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Parent / Guardian
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <input
                    type="text"
                    name="parentName"
                    placeholder="Parent / Guardian name"
                    value={
                      newStudent.parentName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="parentRelationship"
                    placeholder="Relationship"
                    value={
                      newStudent.parentRelationship
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="tel"
                    name="parentPhone"
                    placeholder="Parent phone"
                    value={
                      newStudent.parentPhone
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="email"
                    name="parentEmail"
                    placeholder="Parent email"
                    value={
                      newStudent.parentEmail
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="address"
                    placeholder="Residential address"
                    value={
                      newStudent.address
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="secondaryParentName"
                    placeholder="Secondary parent name"
                    value={
                      newStudent.secondaryParentName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="tel"
                    name="secondaryParentPhone"
                    placeholder="Secondary parent phone"
                    value={
                      newStudent.secondaryParentPhone
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="emergencyContactName"
                    placeholder="Emergency contact name"
                    value={
                      newStudent.emergencyContactName
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    placeholder="Emergency contact phone"
                    value={
                      newStudent.emergencyContactPhone
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                </div>

                {/* SCHOOL INFORMATION */}

                <h3
                  style={{
                    marginTop:
                      "35px",
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  School Information
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <input
                    type="text"
                    name="previousSchool"
                    placeholder="Previous school"
                    value={
                      newStudent.previousSchool
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="medicalInformation"
                    placeholder="Medical information"
                    value={
                      newStudent.medicalInformation
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="notes"
                    placeholder="Additional notes"
                    value={
                      newStudent.notes
                    }
                    onChange={
                      handleNewStudentChange
                    }
                    className="search-input"
                  />

                </div>

                {/* GUARDIAN RECORD */}

                <h3
                  style={{
                    marginTop:
                      "35px",
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Guardian Record
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <input
                    type="text"
                    name="fullName"
                    placeholder="Guardian full name"
                    value={
                      newStudent.guardian.fullName
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="relationship"
                    placeholder="Guardian relationship"
                    value={
                      newStudent.guardian.relationship
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="nationality"
                    placeholder="Guardian nationality"
                    value={
                      newStudent.guardian.nationality
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="state"
                    placeholder="Guardian state"
                    value={
                      newStudent.guardian.state
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="occupation"
                    placeholder="Guardian occupation"
                    value={
                      newStudent.guardian.occupation
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="religion"
                    placeholder="Guardian religion"
                    value={
                      newStudent.guardian.religion
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="denomination"
                    placeholder="Guardian denomination"
                    value={
                      newStudent.guardian.denomination
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="date"
                    name="dateOfBirth"
                    value={
                      newStudent.guardian.dateOfBirth
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <input
                    type="date"
                    name="marriageAnniversary"
                    value={
                      newStudent.guardian.marriageAnniversary
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="residentialAddress"
                    placeholder="Guardian residential address"
                    value={
                      newStudent.guardian.residentialAddress
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="contactAddress"
                    placeholder="Guardian contact address"
                    value={
                      newStudent.guardian.contactAddress
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="medicalDeclaration"
                    placeholder="Guardian medical declaration"
                    value={
                      newStudent.guardian.medicalDeclaration
                    }
                    onChange={
                      handleGuardianChange
                    }
                    className="search-input"
                  />

                </div>

                {/* ADMISSION */}

                <h3
                  style={{
                    marginTop:
                      "35px",
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Admission / School Use
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <select
                    name="admissionStatus"
                    value={
                      newStudent.admission.admissionStatus
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="filter-select"
                  >
                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Accepted">
                      Accepted
                    </option>

                    <option value="Not Accepted">
                      Not Accepted
                    </option>
                  </select>

                  <input
                    type="date"
                    name="declarationDate"
                    value={
                      newStudent.admission.declarationDate
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="search-input"
                  />

                  <textarea
                    name="parentDeclaration"
                    placeholder="Parent declaration"
                    value={
                      newStudent.admission.parentDeclaration
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="parentSignatureName"
                    placeholder="Parent signature / name"
                    value={
                      newStudent.admission.parentSignatureName
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="schoolAuthorizedBy"
                    placeholder="School authorized by"
                    value={
                      newStudent.admission.schoolAuthorizedBy
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="schoolSignatureName"
                    placeholder="School signature / name"
                    value={
                      newStudent.admission.schoolSignatureName
                    }
                    onChange={
                      handleAdmissionChange
                    }
                    className="search-input"
                  />

                </div>

              </>
            )}

            {/* ==================================================
                RETURNING STUDENT
            ================================================== */}

            {registrationType ===
              "returning" && (
              <>

                <div
                  style={{
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px",
                    padding:
                      "15px",
                    marginBottom:
                      "25px",
                  }}
                >
                  <strong>
                    Returning Student
                  </strong>

                  <p
                    style={{
                      marginTop:
                        "5px",
                      color:
                        "#64748b",
                    }}
                  >
                    Search the student's
                    existing school record.
                    Do not create a duplicate
                    student record.
                  </p>

                </div>

                <h3
                  style={{
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Find Existing Student
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap:
                      "15px",
                  }}
                >

                  <input
                    type="text"
                    name="admissionNo"
                    placeholder="Admission Number"
                    value={
                      returningStudent.admissionNo
                    }
                    onChange={
                      handleReturningStudentChange
                    }
                    className="search-input"
                  />

                  <div />

                  <input
                    type="text"
                    name="firstName"
                    placeholder="First name"
                    value={
                      returningStudent.firstName
                    }
                    onChange={
                      handleReturningStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last name"
                    value={
                      returningStudent.lastName
                    }
                    onChange={
                      handleReturningStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="date"
                    name="dateOfBirth"
                    value={
                      returningStudent.dateOfBirth
                    }
                    onChange={
                      handleReturningStudentChange
                    }
                    className="search-input"
                  />

                  <input
                    type="tel"
                    name="parentPhone"
                    placeholder="Parent phone"
                    value={
                      returningStudent.parentPhone
                    }
                    onChange={
                      handleReturningStudentChange
                    }
                    className="search-input"
                  />

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={
                      searchReturningStudents
                    }
                    disabled={
                      searchingReturning
                    }
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    {searchingReturning
                      ? "Searching..."
                      : "Search Existing Student"}
                  </button>

                </div>

                {/* MATCHES */}

                {returningMatches.length >
                  0 && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "15px",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "10px",
                      background:
                        "#f8fafc",
                    }}
                  >

                    <h3>
                      Matching Students
                    </h3>

                    {returningMatches.map(
                      (student) => {
                        const isSelected =
                          selectedReturningStudent?.id ===
                          student.id;

                        return (
                          <button
                            key={
                              student.id
                            }
                            type="button"
                            onClick={() =>
                              selectReturningStudent(
                                student
                              )
                            }
                            style={{
                              display:
                                "block",
                              width:
                                "100%",
                              textAlign:
                                "left",
                              padding:
                                "15px",
                              marginTop:
                                "10px",
                              border:
                                isSelected
                                  ? "2px solid #1f2a44"
                                  : "1px solid #cbd5e1",
                              borderRadius:
                                "8px",
                              background:
                                isSelected
                                  ? "#e0f2fe"
                                  : "#fff",
                              color:
                                "#1f2937",
                              cursor:
                                "pointer",
                            }}
                          >

                            <strong>
                              {student.first_name}{" "}
                              {student.middle_name
                                ? `${student.middle_name} `
                                : ""}
                              {student.last_name}
                            </strong>

                            <br />

                            <small>
                              Admission No:{" "}
                              {
                                student.admission_no
                              }
                            </small>

                            <br />

                            <small>
                              Parent:{" "}
                              {
                                student.parent_name ||
                                "—"
                              }
                            </small>

                            <br />

                            <small>
                              Phone:{" "}
                              {
                                student.parent_phone ||
                                "—"
                              }
                            </small>

                            {isSelected && (
                              <div
                                style={{
                                  marginTop:
                                    "8px",
                                  fontWeight:
                                    "600",
                                }}
                              >
                                ✓ Student selected
                              </div>
                            )}

                          </button>
                        );
                      }
                    )}

                  </div>
                )}

                {/* SELECTED STUDENT */}

                {selectedReturningStudent && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "18px",
                      borderRadius:
                        "10px",
                      background:
                        "#ecfdf5",
                      border:
                        "1px solid #86efac",
                    }}
                  >

                    <h3>
                      Selected Student
                    </h3>

                    <p>
                      <strong>
                        {
                          selectedReturningStudent.first_name
                        }{" "}
                        {
                          selectedReturningStudent.last_name
                        }
                      </strong>
                    </p>

                    <p>
                      Admission No:{" "}
                      <strong>
                        {
                          selectedReturningStudent.admission_no
                        }
                      </strong>
                    </p>

                    <p
                      style={{
                        marginBottom:
                          "0",
                        color:
                          "#166534",
                      }}
                    >
                      Existing student record
                      confirmed. Only the new
                      enrollment will be created.
                    </p>

                  </div>
                )}

                {/* CURRENT CLASS */}

                <h3
                  style={{
                    marginTop:
                      "30px",
                    marginBottom:
                      "15px",
                    color:
                      "#1f2a44",
                  }}
                >
                  Current Academic Class
                </h3>

                <select
                  value={
                    returningStudent.classId
                  }
                  onChange={
                    handleReturningClassChange
                  }
                  className="filter-select"
                  style={{
                    width:
                      "100%",
                    maxWidth:
                      "500px",
                  }}
                >

                  <option value="">
                    Select Current Class *
                  </option>

                  {classes.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.name}
                      </option>
                    )
                  )}

                </select>

              </>
            )}

            {/* ==================================================
                BUTTONS
            ================================================== */}

            <div
              style={{
                marginTop:
                  "30px",
              }}
            >

              <button
                type="submit"
                className="primary-btn"
                disabled={
                  saving ||
                  (
                    registrationType ===
                      "returning" &&
                    !selectedReturningStudent
                  )
                }
              >
                {saving
                  ? "Saving..."
                  : registrationType ===
                    "new"
                  ? "Register New Student"
                  : "Register Returning Student"}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  setShowForm(false);
                  resetRegistration();
                }}
                style={{
                  background:
                    "#64748b",
                  marginLeft:
                    "10px",
                }}
              >
                Cancel
              </button>

            </div>

          </form>

        </div>
      )}

      {/* ==================================================
          SEARCH / FILTER
      ================================================== */}

      <div className="table-controls">

        <input
          type="text"
          placeholder="🔍 Search by name or admission number..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          className="search-input"
        />

        <select
          value={classFilter}
          onChange={(event) =>
            setClassFilter(
              event.target.value
            )
          }
          className="filter-select"
        >

          <option value="">
            All Classes
          </option>

          {classes.map(
            (item) => (
              <option
                key={
                  item.id
                }
                value={
                  item.name
                }
              >
                {item.name}
              </option>
            )
          )}

        </select>

      </div>

      {/* ==================================================
          STUDENT TABLE
      ================================================== */}

      <div className="page-card">

        <table>

          <thead>
            <tr>
              <th>
                Admission No.
              </th>

              <th>
                Student Name
              </th>

              <th>
                Class
              </th>

              <th>
                Student Type
              </th>
            </tr>
          </thead>

          <tbody>

            {filteredStudents.length >
            0 ? (
              filteredStudents.map(
                (student) => (
                  <tr
                    key={
                      student.id
                    }
                  >

                    <td>
                      {
                        student.admissionNo
                      }
                    </td>

                    <td>
                      {
                        student.fullName
                      }
                    </td>

                    <td>
                      {
                        student.className ||
                        "—"
                      }
                    </td>

                    <td>
                      {
                        student.studentType ||
                        "—"
                      }
                    </td>

                  </tr>
                )
              )
            ) : (
              <tr>
                <td
                  colSpan="4"
                  style={{
                    textAlign:
                      "center",
                    padding:
                      "40px",
                  }}
                >
                  No students found.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

