import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Signup({ onBack }) {
  const { signUp } = useAuth();
  const [schoolName, setSchoolName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setFormError("");

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        schoolName: schoolName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (result.session) {
        setMessage("Account created. You can now access your school portal.");
      } else {
        setMessage("Account created. Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setFormError(err.message || "Unable to create the school account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Create your school</h1>
        <p>Set up your school and create its first Admin account.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="school-name">School name</label>
          <input id="school-name" type="text" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required autoComplete="organization" />

          <label htmlFor="first-name">Admin first name</label>
          <input id="first-name" type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoComplete="given-name" />

          <label htmlFor="last-name">Admin last name</label>
          <input id="last-name" type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} required autoComplete="family-name" />

          <label htmlFor="signup-email">Admin email</label>
          <input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />

          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />

          {formError && <p className="auth-error">{formError}</p>}
          {message && <p className="auth-success">{message}</p>}

          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Creating school..." : "Create school"}
          </button>
        </form>

        <button type="button" className="secondary-btn" onClick={onBack}>
          Back to sign in
        </button>
      </section>
    </main>
  );
}
