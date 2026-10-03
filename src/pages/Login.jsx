import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const ACTIVATION_CONTACTS = [
  {
    label: "WhatsApp — 0906 692 9361",
    url: "https://wa.me/2349066929361?text=Hello%20MEKA%20LOGIC%2C%20I%20would%20like%20to%20activate%20MEKA%20School%20for%20my%20school.",
  },
  {
    label: "WhatsApp — 0906 463 6239",
    url: "https://wa.me/2349064636239?text=Hello%20MEKA%20LOGIC%2C%20I%20would%20like%20to%20activate%20MEKA%20School%20for%20my%20school.",
  },
];

export default function Login() {
  const { user, staff, error, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setFormError(err.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const isUnmappedStaff = user && !staff;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>MEKA School</h1>
        <p>
          {isUnmappedStaff
            ? "Your account is signed in but has not been mapped to an active staff record."
            : "Sign in to access the school portal."}
        </p>

        {isUnmappedStaff ? (
          <>
            <p className="auth-error">
              {error || "Ask an administrator to link your account to the teachers table."}
            </p>
            <button type="button" className="secondary-btn" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />

              {(formError || error) && (
                <p className="auth-error">{formError || error}</p>
              )}

              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="activation-section">
              <p>
                <strong>New school?</strong><br />
                Contact MEKA LOGIC to activate your school before signing in.
              </p>

              {ACTIVATION_CONTACTS.map((contact) => (
                <a
                  key={contact.url}
                  className="secondary-btn activation-button"
                  href={contact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contact.label}
                </a>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
