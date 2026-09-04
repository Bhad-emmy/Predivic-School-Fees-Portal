import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL = "https://predivic-school-fees-portal.onrender.com";

const DEFAULT_SETTINGS = {
  school_name: "Predivic Schools",
  address: "",
  phone: "",
  email: "",
  receipt_footer: "Thank you for your payment.",
  receipt_issued_by: "Secretary",
};

export default function Settings() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("-");

  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [form, setForm] =
    useState(DEFAULT_SETTINGS);

  const [settingsId, setSettingsId] =
    useState(null);

  const [loadingSettings, setLoadingSettings] =
    useState(true);

  const [editingSchool, setEditingSchool] =
    useState(false);

  const [editingReceipt, setEditingReceipt] =
    useState(false);

  const [savingSettings, setSavingSettings] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [staffAccounts, setStaffAccounts] =
    useState([]);

  const [classes, setClasses] =
    useState([]);

  const [staffLoading, setStaffLoading] =
    useState(false);

  const [creatingStaff, setCreatingStaff] =
    useState(false);

  const [staffForm, setStaffForm] =
    useState({
      employeeNo: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      password: "",
      role: "Secretary",
      classIds: [],
    });

  const [error, setError] =
    useState("");

  const isAdmin =
    String(role).toLowerCase() === "admin";

  /* =====================================================
     LOAD ACCOUNT + SCHOOL SETTINGS
  ===================================================== */

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoadingSettings(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        setUser(user || null);

        if (!user) {
          throw new Error(
            "No authenticated user found."
          );
        }

        /* -----------------------------
           LOAD STAFF ROLE
        ----------------------------- */

        const {
          data: teacher,
          error: teacherError,
        } = await supabase
          .from("teachers")
          .select("role")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (teacherError) {
          throw teacherError;
        }

        if (teacher?.role) {
          setRole(teacher.role);
        }

        /* -----------------------------
           LOAD SCHOOL SETTINGS
        ----------------------------- */

        const {
          data: schoolSettings,
          error: settingsError,
        } = await supabase
          .from("school_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (settingsError) {
          throw settingsError;
        }

        if (schoolSettings) {
          const loadedSettings = {
            school_name:
              schoolSettings.school_name ||
              DEFAULT_SETTINGS.school_name,

            address:
              schoolSettings.address || "",

            phone:
              schoolSettings.phone || "",

            email:
              schoolSettings.email || "",

            receipt_footer:
              schoolSettings.receipt_footer ||
              DEFAULT_SETTINGS.receipt_footer,

            receipt_issued_by:
              schoolSettings.receipt_issued_by ||
              DEFAULT_SETTINGS.receipt_issued_by,
          };

          setSettingsId(
            schoolSettings.id
          );

          setSettings(loadedSettings);
          setForm(loadedSettings);
        }
      } catch (err) {
        console.error(
          "SETTINGS LOAD ERROR:",
          err
        );

        setError(
          err.message ||
            "Unable to load settings."
        );
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  /* =====================================================
     STAFF ACCOUNT MANAGEMENT
  ===================================================== */

  useEffect(() => {
    if (!isAdmin) return;

    const loadStaffAccounts = async () => {
      try {
        setStaffLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        const [staffResponse, classesResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/staff-accounts`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }),
            fetch(`${API_URL}/api/classes`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }),
          ]);

        const staffData = await staffResponse.json();
        const classesData = await classesResponse.json();

        if (!staffResponse.ok) {
          throw new Error(
            staffData.error || "Unable to load staff accounts."
          );
        }

        if (!classesResponse.ok) {
          throw new Error(
            classesData.error || "Unable to load classes."
          );
        }

        setStaffAccounts(
          Array.isArray(staffData) ? staffData : []
        );

        setClasses(
          Array.isArray(classesData) ? classesData : []
        );
      } catch (err) {
        console.error("STAFF ACCOUNTS LOAD ERROR:", err);
        setError(
          err.message || "Unable to load staff accounts."
        );
      } finally {
        setStaffLoading(false);
      }
    };

    loadStaffAccounts();
  }, [isAdmin]);

  const handleStaffFormChange = (event) => {
    const { name, value } = event.target;

    setStaffForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "role" && value !== "Teacher"
        ? { classIds: [] }
        : {}),
    }));
  };

  const handleStaffClassChange = (classId) => {
    setStaffForm((current) => ({
      ...current,
      classIds: current.classIds.includes(classId)
        ? current.classIds.filter((id) => id !== classId)
        : [...current.classIds, classId],
    }));
  };

  const resetStaffForm = () => {
    setStaffForm({
      employeeNo: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      password: "",
      role: "Secretary",
      classIds: [],
    });
  };

  const createStaffAccount = async (event) => {
    event.preventDefault();

    if (!isAdmin) {
      setError("Only an Admin can create staff accounts.");
      return;
    }

    try {
      setCreatingStaff(true);
      setMessage("");
      setError("");

      if (staffForm.password.length < 8) {
        throw new Error(
          "Password must contain at least 8 characters."
        );
      }

      if (
        staffForm.role === "Teacher" &&
        staffForm.classIds.length === 0
      ) {
        throw new Error(
          "Select at least one class for a Teacher."
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch(
        `${API_URL}/api/staff-accounts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(staffForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create staff account."
        );
      }

      setStaffAccounts((current) => [
        ...current,
        {
          ...data.staff,
          fullName: [
            data.staff.firstName,
            data.staff.middleName,
            data.staff.lastName,
          ]
            .filter(Boolean)
            .join(" "),
          classes: [],
          hasAuthAccount: true,
        },
      ]);

      resetStaffForm();

      setMessage(
        "Staff account created successfully."
      );
    } catch (err) {
      console.error(
        "CREATE STAFF ACCOUNT ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to create staff account."
      );
    } finally {
      setCreatingStaff(false);
    }
  };

  /* =====================================================
     INPUT HANDLER
  ===================================================== */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =====================================================
     OPEN SCHOOL EDITOR
  ===================================================== */

  const openSchoolEditor = () => {
    if (!isAdmin) return;

    setMessage("");
    setError("");

    setForm(settings);
    setEditingSchool(true);
  };

  /* =====================================================
     OPEN RECEIPT EDITOR
  ===================================================== */

  const openReceiptEditor = () => {
    if (!isAdmin) return;

    setMessage("");
    setError("");

    setForm(settings);
    setEditingReceipt(true);
  };

  /* =====================================================
     CANCEL EDIT
  ===================================================== */

  const cancelEditing = () => {
    setForm(settings);
    setEditingSchool(false);
    setEditingReceipt(false);
  };

  /* =====================================================
     SAVE SCHOOL SETTINGS
  ===================================================== */

  const saveSettings = async () => {
    if (!isAdmin) {
      setError(
        "Only an Admin can edit school settings."
      );
      return;
    }

    try {
      setSavingSettings(true);
      setMessage("");
      setError("");

      const cleanedSettings = {
        school_name:
          form.school_name.trim() ||
          DEFAULT_SETTINGS.school_name,

        address:
          form.address.trim(),

        phone:
          form.phone.trim(),

        email:
          form.email.trim(),

        receipt_footer:
          form.receipt_footer.trim() ||
          DEFAULT_SETTINGS.receipt_footer,

        receipt_issued_by:
          form.receipt_issued_by.trim() ||
          DEFAULT_SETTINGS.receipt_issued_by,
      };

      let savedSettings;

      /* -----------------------------
         UPDATE EXISTING ROW
      ----------------------------- */

      if (settingsId) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("school_settings")
          .update(cleanedSettings)
          .eq("id", settingsId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        savedSettings = data;
      }

      /* -----------------------------
         INSERT IF NO ROW EXISTS
      ----------------------------- */

      else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from("school_settings")
          .insert(cleanedSettings)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        savedSettings = data;

        setSettingsId(
          savedSettings.id
        );
      }

      const updatedSettings = {
        school_name:
          savedSettings.school_name ||
          DEFAULT_SETTINGS.school_name,

        address:
          savedSettings.address || "",

        phone:
          savedSettings.phone || "",

        email:
          savedSettings.email || "",

        receipt_footer:
          savedSettings.receipt_footer ||
          DEFAULT_SETTINGS.receipt_footer,

        receipt_issued_by:
          savedSettings.receipt_issued_by ||
          DEFAULT_SETTINGS.receipt_issued_by,
      };

      setSettings(updatedSettings);
      setForm(updatedSettings);

      setEditingSchool(false);
      setEditingReceipt(false);

      setMessage(
        "School settings saved successfully."
      );
    } catch (err) {
      console.error(
        "SAVE SETTINGS ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to save school settings."
      );
    } finally {
      setSavingSettings(false);
    }
  };

  /* =====================================================
     PASSWORD CHANGE
  ===================================================== */

  const handlePasswordChange = async (
    event
  ) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!newPassword) {
      setError(
        "Enter a new password."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setPasswordLoading(true);

      const {
        error: updateError,
      } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setNewPassword("");
      setConfirmPassword("");

      setMessage(
        "Password updated successfully."
      );
    } catch (err) {
      console.error(
        "PASSWORD UPDATE ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to update password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loadingSettings) {
    return (
      <div className="settings-page">
        <div className="page-header settings-header">
          <div>
            <h1>Settings</h1>
            <p>
              Manage your account and system
              configuration.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="page-header settings-header">
        <div>
          <h1>Settings</h1>

          <p>
            Manage your account and system
            configuration.
          </p>
        </div>
      </div>

      {message && (
        <div className="settings-success">
          {message}
        </div>
      )}

      {error && (
        <div className="settings-error">
          {error}
        </div>
      )}

      {/* =================================================
          ACCOUNT
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>Account</h2>

            <p>
              Your authenticated staff account.
            </p>
          </div>
        </div>

        <div className="settings-grid">

          <div className="settings-item">
            <span>Email</span>

            <strong>
              {user?.email || "-"}
            </strong>
          </div>

          <div className="settings-item">
            <span>Role</span>

            <strong>
              {role}
            </strong>
          </div>

          <div className="settings-item">
            <span>Account ID</span>

            <strong className="settings-small-value">
              {user?.id || "-"}
            </strong>
          </div>

          <div className="settings-item">
            <span>Authentication</span>

            <strong>
              Supabase Auth
            </strong>
          </div>

        </div>
      </div>

      {/* =================================================
          PASSWORD
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>Change Password</h2>

            <p>
              Update the password for your
              authenticated account.
            </p>
          </div>
        </div>

        <form
          className="settings-form"
          onSubmit={
            handlePasswordChange
          }
        >

          <div className="settings-form-grid">

            <div className="settings-field">
              <label>
                New Password
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>

            <div className="settings-field">
              <label>
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>

          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={passwordLoading}
          >
            {passwordLoading
              ? "Updating..."
              : "Update Password"}
          </button>

        </form>
      </div>

      {/* =================================================
          SCHOOL CONFIGURATION
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>
              School Configuration
            </h2>

            <p>
              Information used throughout
              the school system.
            </p>
          </div>

          <span className="settings-badge ready">
            Configured
          </span>
        </div>

        {!editingSchool ? (
          <>
            <div className="settings-grid">

              <button
                type="button"
                className="settings-item settings-clickable"
                onClick={
                  openSchoolEditor
                }
              >
                <span>
                  School Information
                </span>

                <strong>
                  {settings.school_name}
                </strong>

                <small>
                  {settings.address ||
                    "No address configured"}
                </small>

                <small>
                  {settings.phone ||
                    "No phone configured"}
                </small>

                <small>
                  {settings.email ||
                    "No email configured"}
                </small>

                <em>
                  {isAdmin
                    ? "Click to edit"
                    : "Admin only"}
                </em>
              </button>

              <button
                type="button"
                className="settings-item settings-clickable"
                onClick={
                  openSchoolEditor
                }
              >
                <span>
                  Academic Session
                </span>

                <strong>
                  Managed in database
                </strong>

                <small>
                  Academic sessions are
                  stored separately.
                </small>

                <em>
                  Coming next
                </em>
              </button>

              <button
                type="button"
                className="settings-item settings-clickable"
                onClick={
                  openSchoolEditor
                }
              >
                <span>
                  Current Term
                </span>

                <strong>
                  Managed in database
                </strong>

                <small>
                  Terms are associated
                  with academic sessions.
                </small>

                <em>
                  Coming next
                </em>
              </button>

              <button
                type="button"
                className="settings-item settings-clickable"
                onClick={
                  openSchoolEditor
                }
              >
                <span>
                  Class Structure
                </span>

                <strong>
                  Configured
                </strong>

                <small>
                  Creche through SS 3.
                </small>

                <em>
                  Coming next
                </em>
              </button>

            </div>
          </>
        ) : (
          <div className="settings-editor">

            <div className="settings-form-grid">

              <div className="settings-field">
                <label>
                  School Name
                </label>

                <input
                  type="text"
                  name="school_name"
                  value={
                    form.school_name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="School name"
                />
              </div>

              <div className="settings-field">
                <label>
                  Phone
                </label>

                <input
                  type="text"
                  name="phone"
                  value={
                    form.phone
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="School phone number"
                />
              </div>

              <div className="settings-field">
                <label>
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={
                    form.email
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="School email"
                />
              </div>

              <div className="settings-field">
                <label>
                  Address
                </label>

                <input
                  type="text"
                  name="address"
                  value={
                    form.address
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="School address"
                />
              </div>

            </div>

            <div className="settings-editor-actions">

              <button
                type="button"
                className="secondary-btn"
                onClick={
                  cancelEditing
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={
                  saveSettings
                }
                disabled={
                  savingSettings
                }
              >
                {savingSettings
                  ? "Saving..."
                  : "Save School Information"}
              </button>

            </div>

          </div>
        )}

      </div>

      {/* =================================================
          RECEIPT
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>
              Receipt Configuration
            </h2>

            <p>
              Settings for the school's
              printed payment receipts.
            </p>
          </div>

          <span className="settings-badge ready">
            Ready
          </span>
        </div>

        {!editingReceipt ? (
          <div className="settings-grid">

            <button
              type="button"
              className="settings-item settings-clickable"
              onClick={
                openReceiptEditor
              }
            >
              <span>
                Receipt Format
              </span>

              <strong>
                80mm Thermal
              </strong>

              <small>
                Designed for the school's
                thermal receipt printer.
              </small>

              <em>
                {isAdmin
                  ? "Click to edit"
                  : "Admin only"}
              </em>
            </button>

            <button
              type="button"
              className="settings-item settings-clickable"
              onClick={
                openReceiptEditor
              }
            >
              <span>
                Print Style
              </span>

              <strong>
                Black & White
              </strong>

              <small>
                Optimized for thermal
                printing.
              </small>
            </button>

            <button
              type="button"
              className="settings-item settings-clickable"
              onClick={
                openReceiptEditor
              }
            >
              <span>
                Footer
              </span>

              <strong>
                {settings.receipt_footer}
              </strong>

              <em>
                {isAdmin
                  ? "Click to edit"
                  : "Admin only"}
              </em>
            </button>

            <button
              type="button"
              className="settings-item settings-clickable"
              onClick={
                openReceiptEditor
              }
            >
              <span>
                Issued By
              </span>

              <strong>
                {settings.receipt_issued_by}
              </strong>

              <em>
                {isAdmin
                  ? "Click to edit"
                  : "Admin only"}
              </em>
            </button>

          </div>
        ) : (
          <div className="settings-editor">

            <div className="settings-form-grid">

              <div className="settings-field">
                <label>
                  Receipt Footer
                </label>

                <input
                  type="text"
                  name="receipt_footer"
                  value={
                    form.receipt_footer
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Thank you for your payment."
                />
              </div>

              <div className="settings-field">
                <label>
                  Issued By
                </label>

                <input
                  type="text"
                  name="receipt_issued_by"
                  value={
                    form.receipt_issued_by
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Secretary"
                />
              </div>

            </div>

            <div className="settings-editor-actions">

              <button
                type="button"
                className="secondary-btn"
                onClick={
                  cancelEditing
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={
                  saveSettings
                }
                disabled={
                  savingSettings
                }
              >
                {savingSettings
                  ? "Saving..."
                  : "Save Receipt Settings"}
              </button>

            </div>

          </div>
        )}

      </div>

      {/* =================================================
          STAFF ACCOUNTS
      ================================================= */}

      {isAdmin && (
        <div className="settings-section">

          <div className="settings-section-header">
            <div>
              <h2>
                Staff Accounts
              </h2>

              <p>
                Create authenticated Admin, Secretary,
                and Teacher accounts. Teacher accounts can
                be assigned to any of the 16 classes.
              </p>
            </div>

            <span className="settings-badge ready">
              Admin Only
            </span>
          </div>

          <form
            className="settings-form"
            onSubmit={createStaffAccount}
          >

            <div className="settings-form-grid">

              <div className="settings-field">
                <label>
                  Employee No.
                </label>

                <input
                  type="text"
                  name="employeeNo"
                  value={staffForm.employeeNo}
                  onChange={handleStaffFormChange}
                  placeholder="e.g. SEC-001"
                  required
                />
              </div>

              <div className="settings-field">
                <label>
                  Role
                </label>

                <select
                  name="role"
                  value={staffForm.role}
                  onChange={handleStaffFormChange}
                >
                  <option value="Secretary">
                    Secretary
                  </option>

                  <option value="Teacher">
                    Teacher
                  </option>

                  <option value="Admin">
                    Admin
                  </option>
                </select>
              </div>

              <div className="settings-field">
                <label>
                  First Name
                </label>

                <input
                  type="text"
                  name="firstName"
                  value={staffForm.firstName}
                  onChange={handleStaffFormChange}
                  placeholder="First name"
                  required
                />
              </div>

              <div className="settings-field">
                <label>
                  Middle Name
                </label>

                <input
                  type="text"
                  name="middleName"
                  value={staffForm.middleName}
                  onChange={handleStaffFormChange}
                  placeholder="Optional"
                />
              </div>

              <div className="settings-field">
                <label>
                  Last Name
                </label>

                <input
                  type="text"
                  name="lastName"
                  value={staffForm.lastName}
                  onChange={handleStaffFormChange}
                  placeholder="Last name"
                  required
                />
              </div>

              <div className="settings-field">
                <label>
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={staffForm.email}
                  onChange={handleStaffFormChange}
                  placeholder="staff@example.com"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="settings-field">
                <label>
                  Temporary Password
                </label>

                <input
                  type="password"
                  name="password"
                  value={staffForm.password}
                  onChange={handleStaffFormChange}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

            </div>

            {staffForm.role === "Teacher" && (
              <div className="settings-field" style={{ marginTop: "18px" }}>
                <label>
                  Assigned Class(es)
                </label>

                <div
                  className="settings-grid"
                  style={{ marginTop: "10px" }}
                >
                  {classes.map((classItem) => (
                    <label
                      key={classItem.id}
                      className="settings-item settings-clickable"
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={staffForm.classIds.includes(
                          classItem.id
                        )}
                        onChange={() =>
                          handleStaffClassChange(
                            classItem.id
                          )
                        }
                      />

                      <span>
                        {classItem.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="settings-editor-actions">

              <button
                type="button"
                className="secondary-btn"
                onClick={resetStaffForm}
                disabled={creatingStaff}
              >
                Clear
              </button>

              <button
                type="submit"
                className="primary-btn"
                disabled={creatingStaff}
              >
                {creatingStaff
                  ? "Creating..."
                  : "Create Staff Account"}
              </button>

            </div>

          </form>

          <div style={{ marginTop: "28px" }}>

            <div className="settings-section-header">
              <div>
                <h3>
                  Existing Staff
                </h3>

                <p>
                  Passwords are never displayed here.
                </p>
              </div>
            </div>

            {staffLoading ? (
              <p>
                Loading staff accounts...
              </p>
            ) : staffAccounts.length === 0 ? (
              <p>
                No staff accounts found.
              </p>
            ) : (
              <div className="settings-security-list">
                {staffAccounts.map((staff) => (
                  <div
                    className="security-row"
                    key={staff.id}
                  >
                    <div>
                      <strong>
                        {staff.fullName || "-"}
                      </strong>

                      <small
                        style={{
                          display: "block",
                          marginTop: "4px",
                        }}
                      >
                        {staff.employeeNo} • {staff.email}
                      </small>

                      {staff.role === "Teacher" && (
                        <small
                          style={{
                            display: "block",
                            marginTop: "4px",
                          }}
                        >
                          Classes:{" "}
                          {staff.classes?.length
                            ? staff.classes
                                .map((item) => item.name)
                                .join(", ")
                            : "None assigned"}
                        </small>
                      )}
                    </div>

                    <span className="settings-badge ready">
                      {staff.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

      {/* =================================================
          SECURITY
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>Security</h2>

            <p>
              Current authorization controls.
            </p>
          </div>
        </div>

        <div className="settings-security-list">

          <div className="security-row">
            <span>
              Supabase authentication
            </span>

            <span className="settings-badge ready">
              Active
            </span>
          </div>

          <div className="security-row">
            <span>
              Database Row Level Security
            </span>

            <span className="settings-badge ready">
              Active
            </span>
          </div>

          <div className="security-row">
            <span>
              Admin attendance override
            </span>

            <span className="settings-badge ready">
              Admin Only
            </span>
          </div>

          <div className="security-row">
            <span>
              Fee structure editing
            </span>

            <span className="settings-badge ready">
              Admin Only
            </span>
          </div>

          <div className="security-row">
            <span>
              School configuration editing
            </span>

            <span className="settings-badge ready">
              Admin Only
            </span>
          </div>

          <div className="security-row">
            <span>
              Saved attendance direct editing
            </span>

            <span className="settings-badge locked">
              Locked
            </span>
          </div>

        </div>
      </div>

      {/* =================================================
          SYSTEM INFORMATION
      ================================================= */}

      <div className="settings-section">

        <div className="settings-section-header">
          <div>
            <h2>
              System Information
            </h2>

            <p>
              Current Predvic Schools
              technology stack.
            </p>
          </div>
        </div>

        <div className="settings-grid">

          <div className="settings-item">
            <span>Frontend</span>

            <strong>
              React + Vite
            </strong>
          </div>

          <div className="settings-item">
            <span>Backend</span>

            <strong>
              Node.js + Express
            </strong>
          </div>

          <div className="settings-item">
            <span>Database</span>

            <strong>
              Supabase PostgreSQL
            </strong>
          </div>

          <div className="settings-item">
            <span>Receipt Printer</span>

            <strong>
              80mm Thermal
            </strong>
          </div>

        </div>
      </div>

    </div>
  );
}
