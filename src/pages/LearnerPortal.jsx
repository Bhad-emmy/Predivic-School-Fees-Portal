import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/LearnerPortal.css";

const learnerFeatures = [
  { title: "Study Materials", description: "Read WAEC and JAMB revision notes, explanations and worked examples." },
  { title: "WAEC Mock Tests", description: "Practise with authorized past questions and original WAEC-style questions." },
  { title: "JAMB Mock Tests", description: "Take UTME-style timed mocks with your chosen subject combination." },
  { title: "My Progress", description: "Review scores and revision areas once practice is enabled." },
];

export default function LearnerPortal() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [audience, setAudience] = useState("external");
  const [mode, setMode] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data?.session || null);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession || null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = session?.user?.id;
    setProfile(null);
    setProfileError("");
    if (!id) {
      setProfileReady(true);
      return () => { cancelled = true; };
    }
    setProfileReady(false);
    (async () => {
      const { data, error: loadError } = await supabase
        .from("cbt_learners")
        .select("auth_user_id, learner_type, display_name, school_id, student_id")
        .eq("auth_user_id", id)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) setProfileError(loadError.message);
      else setProfile(data);
      setProfileReady(true);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signInOrUp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (data.session) setSession(data.session);
        else setMessage("Check your email to verify your account, then return here to sign in. School students will also need an invitation code.");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        setSession(data.session);
      }
      setPassword("");
    } catch (authError) {
      setError(authError.message || "Could not access your account.");
    } finally {
      setBusy(false);
    }
  };

  const finishRegistration = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!session?.user?.id) throw new Error("Sign in before completing your account.");
      let data, registrationError;
      if (audience === "school") {
        ({ data, error: registrationError } = await supabase.rpc("redeem_cbt_school_invite", {
          p_code: invite.trim(),
        }));
      } else {
        if (name.trim().length < 2) throw new Error("Enter your full name.");
        ({ data, error: registrationError } = await supabase
          .from("cbt_learners")
          .insert({ auth_user_id: session.user.id, learner_type: "external", display_name: name.trim() })
          .select("auth_user_id, learner_type, display_name, school_id, student_id")
          .single());
      }
      if (registrationError) throw registrationError;
      setInvite("");
      setProfile(data);
    } catch (registrationError) {
      setError(registrationError.message || "Unable to complete learner registration.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setError("");
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) setError(signOutError.message);
  };

  if (!ready || !profileReady) {
    return <main className="meka-learn-shell"><div className="meka-learn-card">Loading MEKA Learning Centre...</div></main>;
  }

  return (
    <main className="meka-learn-shell">
      <div className="meka-learn-layout">
        <header className="meka-learn-top">
          <div><strong>MEKA</strong> Learning Centre <span className="meka-learn-beta">CBT Foundation</span></div>
          {session?.user && <button type="button" onClick={signOut}>Sign out</button>}
        </header>

        <section className="meka-learn-intro">
          <p className="meka-learn-overline">MEKA School • CBT</p>
          <h1>Learn, practise and prepare.</h1>
          <p>For registered school students and independent learners — prepare for WAEC and JAMB using mock questions, revision materials and progress tracking.</p>
        </section>

        {error && <p className="meka-learn-error" role="alert">{error}</p>}
        {profileError && <p className="meka-learn-error" role="alert">Learner access is unavailable: {profileError}</p>}
        {message && <p className="meka-learn-message" role="status">{message}</p>}

        {!session?.user && (
          <section className="meka-learn-card meka-learn-auth">
            <div className="meka-learn-switch" role="group" aria-label="Learner type">
              <button type="button" aria-pressed={audience === "external"} className={audience === "external" ? "active" : ""} onClick={() => setAudience("external")}>Independent learner</button>
              <button type="button" aria-pressed={audience === "school"} className={audience === "school" ? "active" : ""} onClick={() => setAudience("school")}>School student</button>
            </div>
            <h2>{mode === "register" ? "Create your account" : "Sign in"}</h2>
            <p className="meka-learn-muted">
              {audience === "school"
                ? "School students need a one-time invitation issued by their school administrator after creating an account."
                : "Independent learners register themselves. No school admission number is required."}
            </p>
            <form className="meka-learn-form" onSubmit={signInOrUp}>
              <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Password<input type="password" minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "register" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <button className="meka-learn-primary" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}</button>
            </form>
            <button className="meka-learn-link" type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setMessage(""); }}>
              {mode === "register" ? "Already registered? Sign in" : "New here? Create an account"}
            </button>
          </section>
        )}

        {session?.user && !profile && !profileError && (
          <section className="meka-learn-card meka-learn-auth">
            <h2>Complete your learner profile</h2>
            <p className="meka-learn-muted">{session.user.email}</p>
            <div className="meka-learn-switch" role="group" aria-label="Account access type">
              <button type="button" aria-pressed={audience === "external"} className={audience === "external" ? "active" : ""} onClick={() => setAudience("external")}>Independent learner</button>
              <button type="button" aria-pressed={audience === "school"} className={audience === "school" ? "active" : ""} onClick={() => setAudience("school")}>School student</button>
            </div>
            <form className="meka-learn-form" onSubmit={finishRegistration}>
              {audience === "external" ? (
                <label>Full name<input type="text" maxLength={120} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></label>
              ) : (
                <label>School invitation code<input type="text" required value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Enter the code issued by your school" /></label>
              )}
              <button type="submit" className="meka-learn-primary" disabled={busy}>{busy ? "Verifying..." : "Activate learner access"}</button>
            </form>
            <p className="meka-learn-muted">A school invitation can only be redeemed once and expires after 48 hours. Contact your school administrator if it expires.</p>
          </section>
        )}

        {profile && (
          <section className="meka-learn-card">
            <div className="meka-learn-profile">
              <div><p className="meka-learn-overline">{profile.learner_type === "school" ? "School student" : "Independent learner"}</p>
                <h2>Welcome, {profile.display_name}</h2>
              </div>
              <span>Profile active</span>
            </div>
            <div className="meka-learn-message" role="status">
              Your learner account is ready. The mock question bank, study library and practice engine have not been enabled yet.
              Your practice scores will not affect school term results or count as official WAEC/JAMB results.
            </div>
            <div className="meka-learn-features">
              {learnerFeatures.map((feature) => (
                <article key={feature.title}><h3>{feature.title}</h3><p>{feature.description}</p><span>Coming soon</span></article>
              ))}
            </div>
          </section>
        )}
        <footer className="meka-learn-footer">Powered by MEKA LOGIC · All CBT marks are mock scores only, not official WAEC, JAMB or school examination results.</footer>
      </div>
    </main>
  );
}
