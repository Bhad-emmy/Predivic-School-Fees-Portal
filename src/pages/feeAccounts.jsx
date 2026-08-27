import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000";

const TERM_OPTIONS = [
  "First Term",
  "Second Term",
  "Third Term",
];

const SESSION_OPTIONS = [
  "2025/2026",
  "2026/2027",
];

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

const CLASS_OPTIONS = [...CLASS_ORDER];

const DEPARTMENT_ORDER = {
  Art: 1,
  Science: 2,
  Commercial: 3,
};

const DEPARTMENT_OPTIONS = [
  "Art",
  "Science",
  "Commercial",
];

const STUDENT_TYPE_OPTIONS = [
  "New",
  "Returning",
];

const createEmptyFeeItem = () => ({
  id: Date.now() + Math.random(),
  name: "",
  amount: "",
});

export default function FeeAccounts() {
  const [activeTab, setActiveTab] =
    useState("accounts");

  // =====================================================
  // STUDENT FEE ACCOUNTS
  // =====================================================

  const [feeAccounts, setFeeAccounts] =
    useState([]);

  const [students, setStudents] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [selectedTerm, setSelectedTerm] =
    useState("All Terms");

  const [selectedSession, setSelectedSession] =
    useState("All Sessions");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // =====================================================
  // ASSIGN FEE MODAL
  // =====================================================

  const [showAssignModal, setShowAssignModal] =
    useState(false);

  const [assigning, setAssigning] =
    useState(false);

  const [assignForm, setAssignForm] =
    useState({
      studentId: "",
      session: "2026/2027",
      term: "First Term",
      feeAccountId: "",
      notes: "",
    });

  // =====================================================
  // FEE STRUCTURE
  // =====================================================

  const [feeStructures, setFeeStructures] =
    useState([]);

  const [structureLoading, setStructureLoading] =
    useState(false);

  const [structureSaving, setStructureSaving] =
    useState(false);

  const [structureForm, setStructureForm] =
    useState({
      session: "2026/2027",
      term: "First Term",
      className: "",
      department: "",
      studentType: "Returning",
      feeItems: [createEmptyFeeItem()],
    });

  const [editingStructureId, setEditingStructureId] =
    useState(null);

  const requiresDepartment =
    structureForm.className === "SS 2" ||
    structureForm.className === "SS 3";

  // =====================================================
  // HELPERS
  // =====================================================

  const formatMoney = (amount) =>
    Number(amount || 0).toLocaleString(
      "en-NG"
    );

  const displayTermName = (term) => {
    const map = {
      "1st Term": "First Term",
      "2nd Term": "Second Term",
      "3rd Term": "Third Term",
    };

    return map[term] || term;
  };

  const apiTermName = (term) => {
    const map = {
      "First Term": "1st Term",
      "Second Term": "2nd Term",
      "Third Term": "3rd Term",
    };

    return map[term] || term;
  };

  const normalizeTerm = (term) => {
    const value = String(term || "")
      .toLowerCase()
      .replace(/\s+/g, "");

    if (
      value === "1stterm" ||
      value === "firstterm"
    ) {
      return "First Term";
    }

    if (
      value === "2ndterm" ||
      value === "secondterm"
    ) {
      return "Second Term";
    }

    if (
      value === "3rdterm" ||
      value === "thirdterm"
    ) {
      return "Third Term";
    }

    return term;
  };

  // =====================================================
  // LOAD STUDENTS
  // =====================================================

  const loadStudents = async () => {
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

    return Array.isArray(data)
      ? data
      : data.records || [];
  };

  // =====================================================
  // LOAD STUDENT FEE ACCOUNTS
  // =====================================================

  const loadFeeAccounts = async () => {
    const response = await fetch(
      `${API_URL}/api/student-fee-accounts`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to load student fee accounts."
      );
    }

    return Array.isArray(data)
      ? data
      : data.records || [];
  };

  // =====================================================
  // LOAD FEE STRUCTURES
  // =====================================================

  const loadFeeStructures = async () => {
    try {
      setStructureLoading(true);

      const response = await fetch(
        `${API_URL}/api/fee-accounts`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load fee structures."
        );
      }

      const records = Array.isArray(data)
        ? data
        : data.records || [];

      const structures = records.map(
        (record) => ({
          id: record.id,

          classId:
            record.classId,

          className:
            record.className ||
            "Unknown Class",

          academicSessionId:
            record.academicSessionId,

          session:
            record.session ||
            "",

          termId:
            record.termId,

          term:
            displayTermName(
              record.term
            ),

          studentType:
            String(
              record.studentType ||
                "Returning"
            ).toLowerCase() === "new"
              ? "New"
              : "Returning",

          department:
            record.department ||
            null,

          total:
            Number(
              record.total || 0
            ),

          notes:
            record.notes || "",

          isActive:
            record.isActive !== false,

          feeItems:
            Array.isArray(
              record.feeItems
            )
              ? record.feeItems
              : [],

          createdAt:
            record.createdAt,

          updatedAt:
            record.updatedAt,
        })
      );

      structures.sort((a, b) => {
        const classA =
          CLASS_ORDER.indexOf(
            a.className
          );

        const classB =
          CLASS_ORDER.indexOf(
            b.className
          );

        const orderA =
          classA === -1
            ? 999
            : classA;

        const orderB =
          classB === -1
            ? 999
            : classB;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        const departmentA =
          DEPARTMENT_ORDER[
            a.department
          ] || 99;

        const departmentB =
          DEPARTMENT_ORDER[
            b.department
          ] || 99;

        if (
          departmentA !==
          departmentB
        ) {
          return (
            departmentA -
            departmentB
          );
        }

        if (
          a.studentType !==
          b.studentType
        ) {
          return a.studentType ===
            "Returning"
            ? -1
            : 1;
        }

        return 0;
      });

      setFeeStructures(
        structures
      );
    } catch (err) {
      console.error(
        "LOAD FEE STRUCTURES ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load fee structures."
      );
    } finally {
      setStructureLoading(false);
    }
  };

  // =====================================================
  // LOAD ALL DATA
  // =====================================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        studentsData,
        accountsData,
      ] = await Promise.all([
        loadStudents(),
        loadFeeAccounts(),
      ]);

      setStudents(
        studentsData
      );

      setFeeAccounts(
        accountsData
      );
    } catch (err) {
      console.error(
        "LOAD DATA ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load fee account data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadFeeStructures();
  }, []);

  // =====================================================
  // STUDENT NAME
  // =====================================================

  const getStudentName = (
    account
  ) => {
    return (
      account?.student?.fullName ||
      "Unknown Student"
    );
  };

  // =====================================================
  // SELECTED STUDENT
  // =====================================================

  const selectedStudent = useMemo(() => {
    return students.find(
      (student) =>
        String(student.id) ===
        String(
          assignForm.studentId
        )
    );
  }, [
    students,
    assignForm.studentId,
  ]);

  // =====================================================
  // STUDENT CLASS
  // =====================================================

  const selectedStudentClass =
    selectedStudent?.className ||
    "";

  // =====================================================
  // STUDENT TYPE
  // =====================================================

  const selectedStudentType =
    String(
      selectedStudent?.studentType ||
        "returning"
    ).toLowerCase() === "new"
      ? "New"
      : "Returning";

  // =====================================================
  // AVAILABLE STRUCTURES FOR STUDENT
  // =====================================================

  const availableStructures =
    useMemo(() => {
      if (!selectedStudent) {
        return [];
      }

      return feeStructures.filter(
        (structure) => {
          const sessionMatches =
            structure.session ===
            assignForm.session;

          const termMatches =
            normalizeTerm(
              structure.term
            ) ===
            assignForm.term;

          const classMatches =
            structure.className ===
            selectedStudentClass;

          const typeMatches =
            structure.studentType ===
            selectedStudentType;

          const departmentMatches =
            structure.className ===
              "SS 2" ||
            structure.className ===
              "SS 3"
              ? true
              : true;

          return (
            sessionMatches &&
            termMatches &&
            classMatches &&
            typeMatches &&
            departmentMatches &&
            structure.isActive
          );
        }
      );
    }, [
      feeStructures,
      selectedStudent,
      selectedStudentClass,
      selectedStudentType,
      assignForm.session,
      assignForm.term,
    ]);

  // =====================================================
  // SELECTED FEE STRUCTURE
  // =====================================================

  const selectedFeeStructure =
    useMemo(() => {
      return feeStructures.find(
        (structure) =>
          String(
            structure.id
          ) ===
          String(
            assignForm.feeAccountId
          )
      );
    }, [
      feeStructures,
      assignForm.feeAccountId,
    ]);

  // =====================================================
  // FILTER STUDENT FEE ACCOUNTS
  // =====================================================

  const filteredFeeAccounts =
    useMemo(() => {
      const searchText =
        search
          .toLowerCase()
          .trim();

      return feeAccounts.filter(
        (account) => {
          const studentName =
            getStudentName(
              account
            ).toLowerCase();

          const accountId =
            String(
              account?.id || ""
            ).toLowerCase();

          const session =
            String(
              account?.session ||
                ""
            );

          const term =
            normalizeTerm(
              account?.term
            );

          const matchesSearch =
            !searchText ||
            studentName.includes(
              searchText
            ) ||
            accountId.includes(
              searchText
            );

          const matchesSession =
            selectedSession ===
              "All Sessions" ||
            session ===
              selectedSession;

          const matchesTerm =
            selectedTerm ===
              "All Terms" ||
            term ===
              selectedTerm;

          return (
            matchesSearch &&
            matchesSession &&
            matchesTerm
          );
        }
      );
    }, [
      feeAccounts,
      search,
      selectedSession,
      selectedTerm,
    ]);

  // =====================================================
  // ASSIGN FORM HANDLERS
  // =====================================================

  const handleAssignChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setAssignForm(
      (previous) => ({
        ...previous,
        [name]: value,

        ...(name ===
          "studentId" && {
          feeAccountId: "",
        }),
      })
    );
  };

  const resetAssignForm = () => {
    setAssignForm({
      studentId: "",
      session: "2026/2027",
      term: "First Term",
      feeAccountId: "",
      notes: "",
    });
  };

  const closeAssignModal = () => {
    if (assigning) {
      return;
    }

    setShowAssignModal(
      false
    );

    resetAssignForm();
  };

  // =====================================================
  // ASSIGN FEE STRUCTURE
  //
  // BACKEND EXPECTS:
  // {
  //   studentId,
  //   feeAccountId,
  //   enrollmentId?,
  //   notes?
  // }
  // =====================================================

  const handleAssignFee = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    if (!assignForm.studentId) {
      setError(
        "Please select a student."
      );
      return;
    }

    if (!assignForm.feeAccountId) {
      setError(
        "Please select a fee structure."
      );
      return;
    }

    try {
      setAssigning(true);

      const payload = {
        studentId:
          assignForm.studentId,

        feeAccountId:
          assignForm.feeAccountId,

        status:
          "outstanding",

        notes:
          assignForm.notes.trim() ||
          null,
      };

      const response = await fetch(
        `${API_URL}/api/student-fee-accounts`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to assign fee structure."
        );
      }

      setShowAssignModal(
        false
      );

      resetAssignForm();

      await loadFeeAccounts();
    } catch (err) {
      console.error(
        "ASSIGN FEE ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to assign fee structure."
      );
    } finally {
      setAssigning(false);
    }
  };

  // =====================================================
  // FEE STRUCTURE FORM
  // =====================================================

  const handleStructureChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setStructureForm(
      (previous) => {
        const updated = {
          ...previous,
          [name]: value,
        };

        if (
          name ===
            "className" &&
          value !== "SS 2" &&
          value !== "SS 3"
        ) {
          updated.department =
            "";
        }

        return updated;
      }
    );
  };

  const handleFeeItemChange = (
    id,
    field,
    value
  ) => {
    setStructureForm(
      (previous) => ({
        ...previous,

        feeItems:
          previous.feeItems.map(
            (item) =>
              item.id === id
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          ),
      })
    );
  };

  const addFeeItem = () => {
    setStructureForm(
      (previous) => ({
        ...previous,

        feeItems: [
          ...previous.feeItems,
          createEmptyFeeItem(),
        ],
      })
    );
  };

  const removeFeeItem = (
    id
  ) => {
    setStructureForm(
      (previous) => {
        if (
          previous.feeItems
            .length === 1
        ) {
          return previous;
        }

        return {
          ...previous,

          feeItems:
            previous.feeItems.filter(
              (item) =>
                item.id !== id
            ),
        };
      }
    );
  };

  const structureTotal =
    useMemo(() => {
      return structureForm.feeItems.reduce(
        (total, item) =>
          total +
          (Number(
            item.amount
          ) || 0),
        0
      );
    }, [
      structureForm.feeItems,
    ]);

  const resetStructureForm =
    () => {
      setStructureForm({
        session: "2026/2027",
        term: "First Term",
        className: "",
        department: "",
        studentType:
          "Returning",
        feeItems: [
          createEmptyFeeItem(),
        ],
      });

      setEditingStructureId(
        null
      );
    };

  // =====================================================
  // SAVE FEE STRUCTURE
  // =====================================================

  const handleSaveStructure =
    async (event) => {
      event.preventDefault();

      setError("");

      if (
        !structureForm.session ||
        !structureForm.term ||
        !structureForm.className
      ) {
        setError(
          "Session, term and class are required."
        );
        return;
      }

      if (
        requiresDepartment &&
        !structureForm.department
      ) {
        setError(
          "Please select a department."
        );
        return;
      }

      const validItems =
        structureForm.feeItems.filter(
          (item) =>
            item.name.trim() &&
            Number(item.amount) >
              0
        );

      if (
        validItems.length === 0
      ) {
        setError(
          "Add at least one valid fee item."
        );
        return;
      }

      try {
        setStructureSaving(
          true
        );

        const payload = {
          session:
            structureForm.session,

          term:
            apiTermName(
              structureForm.term
            ),

          className:
            structureForm.className,

          department:
            requiresDepartment
              ? structureForm.department
              : null,

          studentType:
            structureForm.studentType,

          feeItems:
            validItems.map(
              (item) => ({
                name:
                  item.name.trim(),

                amount:
                  Number(
                    item.amount
                  ),
              })
            ),
        };

        const url =
          editingStructureId
            ? `${API_URL}/api/fee-accounts/${editingStructureId}`
            : `${API_URL}/api/fee-accounts`;

        const response =
          await fetch(url, {
            method:
              editingStructureId
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          });

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to save fee structure."
          );
        }

        resetStructureForm();

        await loadFeeStructures();
      } catch (err) {
        console.error(
          "SAVE FEE STRUCTURE ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to save fee structure."
        );
      } finally {
        setStructureSaving(
          false
        );
      }
    };

  // =====================================================
  // EDIT STRUCTURE
  // =====================================================

  const handleEditStructure =
    (structure) => {
      setError("");

      setStructureForm({
        session:
          structure.session,

        term:
          displayTermName(
            structure.term
          ),

        className:
          structure.className,

        department:
          structure.department ||
          "",

        studentType:
          structure.studentType,

        feeItems:
          structure.feeItems.map(
            (item) => ({
              id:
                Date.now() +
                Math.random(),

              name:
                item.name,

              amount:
                String(
                  item.amount
                ),
            })
          ),
      });

      setEditingStructureId(
        structure.id
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  // =====================================================
  // DELETE STRUCTURE
  // =====================================================

  const handleDeleteStructure =
    async (id) => {
      const confirmed =
        window.confirm(
          "Delete this fee structure?"
        );

      if (!confirmed) {
        return;
      }

      try {
        setError("");
        setStructureSaving(
          true
        );

        const response =
          await fetch(
            `${API_URL}/api/fee-accounts/${id}`,
            {
              method:
                "DELETE",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to delete fee structure."
          );
        }

        if (
          editingStructureId ===
          id
        ) {
          resetStructureForm();
        }

        await loadFeeStructures();
      } catch (err) {
        console.error(
          "DELETE STRUCTURE ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to delete fee structure."
        );
      } finally {
        setStructureSaving(
          false
        );
      }
    };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="page">

      {/* HEADER */}

      <div className="page-header">
        <div>
          <h1>
            Fee Accounts
          </h1>

          <p
            style={{
              color:
                "#64748b",
              marginTop:
                "5px",
            }}
          >
            Manage student fee
            accounts and fee
            structures.
          </p>
        </div>

        {activeTab ===
          "accounts" && (
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              setError("");
              setShowAssignModal(
                true
              );
            }}
          >
            + Assign Fee
          </button>
        )}
      </div>

      {/* TABS */}

      <div
        style={{
          display:
            "flex",
          gap: "8px",
          marginBottom:
            "25px",
          borderBottom:
            "1px solid #e2e8f0",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab(
              "accounts"
            );
            setError("");
          }}
          style={{
            padding:
              "12px 20px",
            border:
              "none",
            borderBottom:
              activeTab ===
              "accounts"
                ? "3px solid #1f2a44"
                : "3px solid transparent",
            background:
              "transparent",
            color:
              activeTab ===
              "accounts"
                ? "#1f2a44"
                : "#64748b",
            fontWeight:
              "600",
            cursor:
              "pointer",
            fontSize:
              "15px",
          }}
        >
          Fee Accounts
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab(
              "structure"
            );
            setError("");
          }}
          style={{
            padding:
              "12px 20px",
            border:
              "none",
            borderBottom:
              activeTab ===
              "structure"
                ? "3px solid #1f2a44"
                : "3px solid transparent",
            background:
              "transparent",
            color:
              activeTab ===
              "structure"
                ? "#1f2a44"
                : "#64748b",
            fontWeight:
              "600",
            cursor:
              "pointer",
            fontSize:
              "15px",
          }}
        >
          Fee Structure
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
              "12px 16px",
            borderRadius:
              "8px",
            marginBottom:
              "20px",
            fontWeight:
              "500",
          }}
        >
          {error}
        </div>
      )}

      {/* =================================================
          FEE ACCOUNTS
      ================================================= */}

      {activeTab ===
        "accounts" && (
        <>
          <div className="table-controls">

            <input
              type="text"
              className="search-input"
              placeholder="Search student or fee account..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <select
              className="filter-select"
              value={
                selectedTerm
              }
              onChange={(event) =>
                setSelectedTerm(
                  event.target
                    .value
                )
              }
            >
              <option value="All Terms">
                All Terms
              </option>

              {TERM_OPTIONS.map(
                (term) => (
                  <option
                    key={term}
                    value={term}
                  >
                    {term}
                  </option>
                )
              )}
            </select>

            <select
              className="filter-select"
              value={
                selectedSession
              }
              onChange={(event) =>
                setSelectedSession(
                  event.target
                    .value
                )
              }
            >
              <option value="All Sessions">
                All Sessions
              </option>

              {SESSION_OPTIONS.map(
                (session) => (
                  <option
                    key={session}
                    value={
                      session
                    }
                  >
                    {session}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="table-section">
            <h2>
              Student Fee
              Accounts
            </h2>

            {loading ? (
              <p
                style={{
                  padding:
                    "30px 0",
                  color:
                    "#64748b",
                }}
              >
                Loading fee
                accounts...
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>
                      Fee Account
                    </th>

                    <th>
                      Student
                    </th>

                    <th>
                      Class
                    </th>

                    <th>
                      Session
                    </th>

                    <th>
                      Term
                    </th>

                    <th>
                      Total Fee
                    </th>

                    <th>
                      Total Paid
                    </th>

                    <th>
                      Balance
                    </th>

                    <th>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredFeeAccounts.length >
                  0 ? (
                    filteredFeeAccounts.map(
                      (
                        account
                      ) => (
                        <tr
                          key={
                            account.id
                          }
                        >
                          <td>
                            {
                              account.id
                            }
                          </td>

                          <td>
                            {getStudentName(
                              account
                            )}
                          </td>

                          <td>
                            {
                              account.className
                            }
                          </td>

                          <td>
                            {
                              account.session
                            }
                          </td>

                          <td>
                            {displayTermName(
                              account.term
                            )}
                          </td>

                          <td>
                            ₦
                            {formatMoney(
                              account.totalAmount
                            )}
                          </td>

                          <td>
                            ₦
                            {formatMoney(
                              account.totalPaid
                            )}
                          </td>

                          <td>
                            ₦
                            {formatMoney(
                              account.balance
                            )}
                          </td>

                          <td>
                            {
                              account.status
                            }
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "40px",
                          color:
                            "#64748b",
                        }}
                      >
                        No fee
                        accounts
                        found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* =================================================
          FEE STRUCTURE
      ================================================= */}

      {activeTab ===
        "structure" && (
        <>
          <div
            className="page-card"
            style={{
              marginBottom:
                "25px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom:
                  "25px",
                flexWrap:
                  "wrap",
                gap:
                  "15px",
              }}
            >
              <div>
                <h2>
                  {editingStructureId
                    ? "Edit Fee Structure"
                    : "Create Fee Structure"}
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                    marginTop:
                      "6px",
                  }}
                >
                  Define the fees
                  that apply to a
                  class for a
                  specific session,
                  term and student
                  type.
                </p>
              </div>

              {editingStructureId && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    resetStructureForm
                  }
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form
              onSubmit={
                handleSaveStructure
              }
            >
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(2, 1fr)",
                  gap:
                    "18px",
                  marginBottom:
                    "30px",
                }}
              >
                <div className="form-group">
                  <label>
                    Academic Session *
                  </label>

                  <select
                    className="filter-select"
                    style={{
                      width:
                        "100%",
                    }}
                    name="session"
                    value={
                      structureForm.session
                    }
                    onChange={
                      handleStructureChange
                    }
                    required
                  >
                    {SESSION_OPTIONS.map(
                      (
                        session
                      ) => (
                        <option
                          key={
                            session
                          }
                          value={
                            session
                          }
                        >
                          {
                            session
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Term *
                  </label>

                  <select
                    className="filter-select"
                    style={{
                      width:
                        "100%",
                    }}
                    name="term"
                    value={
                      structureForm.term
                    }
                    onChange={
                      handleStructureChange
                    }
                    required
                  >
                    {TERM_OPTIONS.map(
                      (
                        term
                      ) => (
                        <option
                          key={
                            term
                          }
                          value={
                            term
                          }
                        >
                          {term}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Class *
                  </label>

                  <select
                    className="filter-select"
                    style={{
                      width:
                        "100%",
                    }}
                    name="className"
                    value={
                      structureForm.className
                    }
                    onChange={
                      handleStructureChange
                    }
                    required
                  >
                    <option value="">
                      Select Class
                    </option>

                    {CLASS_OPTIONS.map(
                      (
                        className
                      ) => (
                        <option
                          key={
                            className
                          }
                          value={
                            className
                          }
                        >
                          {
                            className
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {requiresDepartment && (
                  <div className="form-group">
                    <label>
                      Department *
                    </label>

                    <select
                      className="filter-select"
                      style={{
                        width:
                          "100%",
                      }}
                      name="department"
                      value={
                        structureForm.department
                      }
                      onChange={
                        handleStructureChange
                      }
                      required
                    >
                      <option value="">
                        Select Department
                      </option>

                      {DEPARTMENT_OPTIONS.map(
                        (
                          department
                        ) => (
                          <option
                            key={
                              department
                            }
                            value={
                              department
                            }
                          >
                            {
                              department
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>
                    Student Type *
                  </label>

                  <select
                    className="filter-select"
                    style={{
                      width:
                        "100%",
                    }}
                    name="studentType"
                    value={
                      structureForm.studentType
                    }
                    onChange={
                      handleStructureChange
                    }
                    required
                  >
                    {STUDENT_TYPE_OPTIONS.map(
                      (
                        type
                      ) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginBottom:
                    "25px",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    marginBottom:
                      "15px",
                    flexWrap:
                      "wrap",
                    gap:
                      "10px",
                  }}
                >
                  <div>
                    <h3>
                      Fee Items
                    </h3>

                    <p
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "14px",
                        marginTop:
                          "4px",
                      }}
                    >
                      Add each fee
                      separately.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={
                      addFeeItem
                    }
                  >
                    + Add Fee Item
                  </button>
                </div>

                <div
                  style={{
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px",
                    overflow:
                      "hidden",
                  }}
                >
                  {structureForm.feeItems.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "60px 1fr 220px 110px",
                          gap:
                            "12px",
                          alignItems:
                            "center",
                          padding:
                            "14px 16px",
                          borderBottom:
                            index ===
                            structureForm
                              .feeItems
                              .length -
                              1
                              ? "none"
                              : "1px solid #e2e8f0",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "#64748b",
                            fontWeight:
                              "600",
                          }}
                        >
                          {index +
                            1}
                        </span>

                        <input
                          type="text"
                          placeholder="Fee item name"
                          value={
                            item.name
                          }
                          onChange={(
                            event
                          ) =>
                            handleFeeItemChange(
                              item.id,
                              "name",
                              event
                                .target
                                .value
                            )
                          }
                          style={{
                            width:
                              "100%",
                            padding:
                              "12px 14px",
                            border:
                              "1px solid #d1d5db",
                            borderRadius:
                              "8px",
                            fontSize:
                              "15px",
                          }}
                        />

                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Amount"
                          value={
                            item.amount
                          }
                          onChange={(
                            event
                          ) =>
                            handleFeeItemChange(
                              item.id,
                              "amount",
                              event
                                .target
                                .value
                            )
                          }
                          style={{
                            width:
                              "100%",
                            padding:
                              "12px 14px",
                            border:
                              "1px solid #d1d5db",
                            borderRadius:
                              "8px",
                            fontSize:
                              "15px",
                          }}
                        />

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            removeFeeItem(
                              item.id
                            )
                          }
                          disabled={
                            structureForm
                              .feeItems
                              .length ===
                            1
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  marginBottom:
                    "25px",
                }}
              >
                <div
                  style={{
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px",
                    padding:
                      "18px 24px",
                    minWidth:
                      "260px",
                    textAlign:
                      "right",
                  }}
                >
                  <p
                    style={{
                      color:
                        "#64748b",
                      fontSize:
                        "14px",
                    }}
                  >
                    Total Fee
                  </p>

                  <strong
                    style={{
                      fontSize:
                        "26px",
                      color:
                        "#1f2a44",
                    }}
                  >
                    ₦
                    {formatMoney(
                      structureTotal
                    )}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap:
                    "10px",
                }}
              >
                {editingStructureId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={
                      resetStructureForm
                    }
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={
                    structureSaving
                  }
                >
                  {structureSaving
                    ? "Saving..."
                    : editingStructureId
                    ? "Update Fee Structure"
                    : "Save Fee Structure"}
                </button>
              </div>
            </form>
          </div>

          {/* SAVED STRUCTURES */}

          <div className="table-section">
            <h2>
              Saved Fee Structures
            </h2>

            {structureLoading ? (
              <div
                style={{
                  padding:
                    "40px",
                  textAlign:
                    "center",
                  color:
                    "#64748b",
                }}
              >
                Loading fee
                structures...
              </div>
            ) : feeStructures.length ===
              0 ? (
              <div
                style={{
                  padding:
                    "40px",
                  textAlign:
                    "center",
                  color:
                    "#64748b",
                }}
              >
                No fee
                structures yet.
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>
                        Class
                      </th>
                      <th>
                        Session
                      </th>
                      <th>
                        Term
                      </th>
                      <th>
                        Department
                      </th>
                      <th>
                        Student Type
                      </th>
                      <th>
                        Fee Items
                      </th>
                      <th>
                        Total
                      </th>
                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {feeStructures.map(
                      (
                        structure
                      ) => (
                        <tr
                          key={
                            structure.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                structure.className
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              structure.session
                            }
                          </td>

                          <td>
                            {displayTermName(
                              structure.term
                            )}
                          </td>

                          <td>
                            {structure.department ||
                              "—"}
                          </td>

                          <td>
                            {
                              structure.studentType
                            }
                          </td>

                          <td>
                            {structure.feeItems.map(
                              (
                                item
                              ) => (
                                <div
                                  key={
                                    item.id ||
                                    item.name
                                  }
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    gap:
                                      "20px",
                                    minWidth:
                                      "180px",
                                    marginBottom:
                                      "4px",
                                  }}
                                >
                                  <span>
                                    {
                                      item.name
                                    }
                                  </span>

                                  <span>
                                    ₦
                                    {formatMoney(
                                      item.amount
                                    )}
                                  </span>
                                </div>
                              )
                            )}
                          </td>

                          <td>
                            <strong>
                              ₦
                              {formatMoney(
                                structure.total
                              )}
                            </strong>
                          </td>

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                gap:
                                  "8px",
                              }}
                            >
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() =>
                                  handleEditStructure(
                                    structure
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() =>
                                  handleDeleteStructure(
                                    structure.id
                                  )
                                }
                                style={{
                                  color:
                                    "#991b1b",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =================================================
          ASSIGN FEE MODAL
      ================================================= */}

      {showAssignModal && (
        <div
          className="modal-overlay"
          onClick={
            closeAssignModal
          }
        >
          <div
            className="modal-card"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              maxWidth:
                "650px",
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Assign Fee
                  Structure
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                    marginTop:
                      "5px",
                    fontSize:
                      "14px",
                  }}
                >
                  Assign an existing
                  fee structure to
                  a student.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeAssignModal
                }
                disabled={
                  assigning
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleAssignFee
              }
            >
              {/* STUDENT */}

              <div className="form-group">
                <label>
                  Student *
                </label>

                <select
                  name="studentId"
                  value={
                    assignForm.studentId
                  }
                  onChange={
                    handleAssignChange
                  }
                  required
                >
                  <option value="">
                    Select Student
                  </option>

                  {students.map(
                    (
                      student
                    ) => (
                      <option
                        key={
                          student.id
                        }
                        value={
                          student.id
                        }
                      >
                        {student.fullName ||
                          [
                            student.firstName,
                            student.middleName,
                            student.lastName,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " "
                            ) ||
                          "Unnamed Student"}
                        {student.className
                          ? ` — ${student.className}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* STUDENT INFO */}

              {selectedStudent && (
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap:
                      "12px",
                    marginBottom:
                      "20px",
                  }}
                >
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      background:
                        "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "8px",
                    }}
                  >
                    <small
                      style={{
                        color:
                          "#64748b",
                      }}
                    >
                      Class
                    </small>

                    <div
                      style={{
                        fontWeight:
                          "600",
                        marginTop:
                          "4px",
                      }}
                    >
                      {selectedStudentClass ||
                        "No class assigned"}
                    </div>
                  </div>

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      background:
                        "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "8px",
                    }}
                  >
                    <small
                      style={{
                        color:
                          "#64748b",
                      }}
                    >
                      Student Type
                    </small>

                    <div
                      style={{
                        fontWeight:
                          "600",
                        marginTop:
                          "4px",
                      }}
                    >
                      {
                        selectedStudentType
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* SESSION + TERM */}

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Session *
                  </label>

                  <select
                    name="session"
                    value={
                      assignForm.session
                    }
                    onChange={
                      handleAssignChange
                    }
                    required
                  >
                    {SESSION_OPTIONS.map(
                      (
                        session
                      ) => (
                        <option
                          key={
                            session
                          }
                          value={
                            session
                          }
                        >
                          {
                            session
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Term *
                  </label>

                  <select
                    name="term"
                    value={
                      assignForm.term
                    }
                    onChange={
                      handleAssignChange
                    }
                    required
                  >
                    {TERM_OPTIONS.map(
                      (
                        term
                      ) => (
                        <option
                          key={
                            term
                          }
                          value={
                            term
                          }
                        >
                          {term}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* FEE STRUCTURE */}

              <div className="form-group">
                <label>
                  Fee Structure *
                </label>

                <select
                  name="feeAccountId"
                  value={
                    assignForm.feeAccountId
                  }
                  onChange={
                    handleAssignChange
                  }
                  disabled={
                    !selectedStudent
                  }
                  required
                >
                  <option value="">
                    {!selectedStudent
                      ? "Select a student first"
                      : availableStructures.length ===
                        0
                      ? "No matching fee structure"
                      : "Select Fee Structure"}
                  </option>

                  {availableStructures.map(
                    (
                      structure
                    ) => (
                      <option
                        key={
                          structure.id
                        }
                        value={
                          structure.id
                        }
                      >
                        {structure.className}
                        {" — "}
                        {structure.studentType}
                        {structure.department
                          ? ` — ${structure.department}`
                          : ""}
                        {" — "}
                        {structure.session}
                        {" — "}
                        {
                          displayTermName(
                            structure.term
                          )
                        }
                        {" — ₦"}
                        {formatMoney(
                          structure.total
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* SELECTED STRUCTURE SUMMARY */}

              {selectedFeeStructure && (
                <div
                  style={{
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px",
                    padding:
                      "18px",
                    marginBottom:
                      "20px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        "12px",
                    }}
                  >
                    <div>
                      <strong>
                        {
                          selectedFeeStructure.className
                        }
                      </strong>

                      <div
                        style={{
                          color:
                            "#64748b",
                          fontSize:
                            "13px",
                          marginTop:
                            "3px",
                        }}
                      >
                        {
                          selectedFeeStructure.studentType
                        }

                        {" • "}

                        {
                          selectedFeeStructure.session
                        }

                        {" • "}

                        {displayTermName(
                          selectedFeeStructure.term
                        )}
                      </div>
                    </div>

                    <strong
                      style={{
                        fontSize:
                          "22px",
                        color:
                          "#1f2a44",
                      }}
                    >
                      ₦
                      {formatMoney(
                        selectedFeeStructure.total
                      )}
                    </strong>
                  </div>

                  <div>
                    {selectedFeeStructure.feeItems.map(
                      (
                        item
                      ) => (
                        <div
                          key={
                            item.id ||
                            item.name
                          }
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            padding:
                              "6px 0",
                            borderBottom:
                              "1px solid #e2e8f0",
                          }}
                        >
                          <span>
                            {
                              item.name
                            }
                          </span>

                          <span>
                            ₦
                            {formatMoney(
                              item.amount
                            )}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* NOTES */}

              <div className="form-group">
                <label>
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={
                    assignForm.notes
                  }
                  onChange={
                    handleAssignChange
                  }
                  placeholder="Optional note..."
                  rows="3"
                  style={{
                    width:
                      "100%",
                    resize:
                      "vertical",
                  }}
                />
              </div>

              {/* ACTIONS */}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    closeAssignModal
                  }
                  disabled={
                    assigning
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={
                    assigning ||
                    !selectedFeeStructure
                  }
                >
                  {assigning
                    ? "Assigning..."
                    : "Assign Fee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
