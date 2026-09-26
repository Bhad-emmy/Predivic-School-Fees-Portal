import { useState } from "react";
import Signup from "./Signup";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, staff, error, signIn, signOut, resendVerification } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setVerificationSent(false);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setFormError(err.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setFormError("");
      await resendVerification(email.trim());
      setVerificationSent(true);
    } catch (err) {
      setFormError(err.message || "Unable to resend verification email.");
    }
  };

  if (showSignup) {
    return <Signup onBack={() => setShowSignup(false)} />;
  }

  const isUnmappedStaff = user && !staff;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>MEKA School</h1>
        <p>{isUnmappedStaff ? "Your account is signed in but has not been mapped to an active staff record." : "Sign in to access the school portal."}</p>

        {isUnmappedStaff ? (
          <>
            <p className="auth-error">{error || "Ask an administrator to link your account to the teachers table."}</p>
            <button type="button" className="secondary-btn" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />

              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />

              {(formError || error) && <p className="auth-error">{formError || error}</p>}
              {verificationSent && <p className="auth-success">Verification email sent. Check your inbox and spam folder.</p>}

              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <button
              type="button"
              className="link-btn"
              onClick={handleResendVerification}
              disabled={!email.trim() || submitting}
              style={{ marginTop: "10px" }}
            >
              Resend verification email
            </button>

            <p className="auth-switch">
              New school?{" "}
              <button type="button" className="link-btn" onClick={() => setShowSignup(true)}>
                Create an account
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
