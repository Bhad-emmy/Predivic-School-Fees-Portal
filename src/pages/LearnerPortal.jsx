import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CBT_MONTHLY_PLAN, formatCbtPrice } from "../lib/cbtPlan";
import CBTTopicPractice from "../components/CBTTopicPractice";
import "../styles/LearnerPortal.css";

const learnerFeatures = [
  { title: "Study Materials", description: "Read WAEC and JAMB revision notes, explanations and worked examples." },
  { title: "WAEC Mock Tests", description: "Practise with authorized past questions and original WAEC-style questions." },
  { title: "JAMB Mock Tests", description: "Take UTME-style timed mocks with your chosen subject combination." },
  { title: "My Progress", description: "View practice scores and revision areas as tracking features are expanded." },
];

export default function LearnerPortal() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [mode, setMode] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkingSchool, setLinkingSchool] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activation, setActivation] = useState(null);
  const [activationReady, setActivationReady] = useState(false);
  const [activationPin, setActivationPin] = useState("");
  const [activating, setActivating] = useState(false);
  const [opaySalesOpen, setOpaySalesOpen] = useState(false);

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
          options: { emailRedirectTo: `${window.location.origin}/learn` },
        });
        if (authError) throw authError;
        if (data.session) setSession(data.session);
        else setMessage("Check your email to verify your account, then return here and sign in. Anyone can create a learner profile without a school invitation.");
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
      if (name.trim().length < 2) throw new Error("Enter your full name.");
      const { data, error: registrationError } = await supabase
        .from("cbt_learners")
        .insert({
          auth_user_id: session.user.id,
          learner_type: "external",
          display_name: name.trim(),
        })
        .select("auth_user_id, learner_type, display_name, school_id, student_id")
        .single();
      if (registrationError) throw registrationError;
      setInvite("");
      setProfile(data);
    } catch (registrationError) {
      setError(registrationError.message || "Unable to complete learner registration.");
    } finally {
      setBusy(false);
    }
  };


  const linkSchool = async (event) => {
    event.preventDefault();
    setLinkingSchool(true);
    setError("");
    setMessage("");
    try {
      if (!profile || profile.learner_type !== "external") {
        throw new Error("Only independent accounts can be linked to a school.");
      }
      if (!invite.trim()) throw new Error("Enter the one-time code issued by your school.");
      const { data, error: linkError } = await supabase.rpc("redeem_cbt_school_invite", {
        p_code: invite.trim(),
      });
      if (linkError) throw linkError;
      setProfile(data);
      setInvite("");
      setMessage("Your school has been linked. Your practice history will remain on this account.");
    } catch (linkError) {
      setError(linkError.message || "Unable to link your school.");
    } finally {
      setLinkingSchool(false);
    }
  };


  useEffect(() => {
    let cancelled = false;
    const id = session?.user?.id;
    if (!id || !profile?.auth_user_id) {
      setActivation(null);
      setActivationReady(true);
      return () => { cancelled = true; };
    }
    setActivationReady(false);
    (async () => {
      const { data, error: activationError } = await supabase
        .from("cbt_access_grants")
        .select("auth_user_id, activated_at, expires_at")
        .eq("auth_user_id", id)
        .maybeSingle();
      if (cancelled) return;
      if (activationError) setError("Could not check CBT activation status: " + activationError.message);
      else setActivation(data);
      setActivationReady(true);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, profile?.auth_user_id]);

  const redeemActivationPin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setActivating(true);
    try {
      const code = activationPin.trim().toUpperCase();
      if (!code) throw new Error("Enter your activation PIN.");
      const { data, error: redeemError } = await supabase.rpc("redeem_cbt_activation_pin", {
        p_pin: code,
      });
      if (redeemError) throw redeemError;
      setActivation(data);
      setActivationPin("");
      setMessage("CBT access activated on your account. The question bank and mock tests are still under development.");
    } catch (redeemError) {
      setError(redeemError.message || "Unable to activate this PIN.");
    } finally {
      setActivating(false);
    }
  };

  const activationActive = Boolean(activation && (
    !activation.expires_at || new Date(activation.expires_at).getTime() > Date.now()
  ));


  useEffect(() => {
    let mounted = true;
    if (!profile?.auth_user_id) return () => { mounted = false; };
    supabase.rpc("cbt_opay_sales_enabled").then(({ data, error: salesError }) => {
      if (mounted && !salesError) setOpaySalesOpen(Boolean(data));
    });
    return () => { mounted = false; };
  }, [profile?.auth_user_id]);

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
          <p className="meka-learn-overline">MEKA CBT • WAEC & JAMB mock preparation</p>
          <h1>Prepare for WAEC and JAMB, wherever you learn.</h1>
          <p>A public exam-preparation platform for learners across Nigeria. Practise questions, take timed mock tests and revise topics at your own pace. A school account is optional.</p>
        </section>

        {error && <p className="meka-learn-error" role="alert">{error}</p>}
        {profileError && <p className="meka-learn-error" role="alert">Learner access is unavailable: {profileError}</p>}
        {message && <p className="meka-learn-message" role="status">{message}</p>}

        {!session?.user && (
          <section className="meka-learn-card meka-learn-auth">
            <h2>{mode === "register" ? "Create your account" : "Sign in"}</h2>
            <p className="meka-learn-muted">
              Open to everyone preparing for WAEC or JAMB. Sign up directly without a school invitation or admission number.
              If your school uses MEKA, you can connect your school to this account later.
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
            <form className="meka-learn-form" onSubmit={finishRegistration}>
              <label>Full name<input type="text" maxLength={120} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></label>
              <button type="submit" className="meka-learn-primary" disabled={busy}>{busy ? "Creating profile..." : "Create free learner profile"}</button>
            </form>
            <p className="meka-learn-muted">All learners use the same public account. School linking is optional and can be completed after registration.</p>
          </section>
        )}

        {profile && (
          <section className="meka-learn-card">
            <div className="meka-learn-profile">
              <div><p className="meka-learn-overline">{profile.learner_type === "school" ? "School student" : "Independent learner"}</p>
                <h2>Welcome, {profile.display_name}</h2>
              </div>
              <span>{profile.learner_type === "school" ? "School linked" : "Public learner"}</span>
            </div>
            <div className="meka-learn-message" role="status">
              Your learner profile is active. Approved sample topic questions will appear below when the content team publishes them. Full timed mock examinations and study materials are still being developed.
              Your practice scores will not affect school term results or count as official WAEC/JAMB results.
            </div>
            {profile.learner_type === "external" && (
              <form className="meka-learn-link-school" onSubmit={linkSchool}>
                <h3>Attend a school using MEKA?</h3>
                <p className="meka-learn-muted">Link your school to this account without losing your practice history. This is optional; public mock practice remains available either way.</p>
                <label>One-time school invitation code
                  <input type="text" required value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="Paste the code from your school administrator" />
                </label>
                <button className="meka-learn-primary" type="submit" disabled={linkingSchool}>{linkingSchool ? "Linking..." : "Link my school"}</button>
              </form>
            )}
            <section className="meka-learn-activation" aria-label="CBT access activation">
              <h3>{activationActive ? "Your 30-day CBT access is active" : "Activate your CBT access"}</h3>
              <p className="meka-learn-plan-price">
                {formatCbtPrice()} <span>/ {CBT_MONTHLY_PLAN.durationDays} days</span>
              </p>
              <p className="meka-learn-muted">
                Pay manually by OPay transfer only after receiving the correct recipient details from official MEKA CBT support.
                Then send the transaction reference on WhatsApp. An operator must verify the credit in OPay before sending a PIN.
              </p>
              {opaySalesOpen ? (
                <a className="meka-learn-contact-link"
                  href={`https://wa.me/${import.meta.env.VITE_CBT_WHATSAPP_NUMBER || "2349064636239"}?text=${encodeURIComponent("Hello MEKA CBT support. I would like to pay ₦1,500 via OPay for a 30-day WAEC/JAMB mock activation PIN. Please share the verified OPay account details and payment instructions. I will send my transaction reference for confirmation.")}`}
                  target="_blank" rel="noopener noreferrer">
                  Contact MEKA CBT on WhatsApp for OPay details
                </a>
              ) : (
                <p className="meka-learn-muted">
                  Manual OPay PIN sales are not open yet. Do not send money until MEKA confirms the activation service is ready.
                </p>
              )}
              {!activationReady ? (
                <p className="meka-learn-muted">Checking activation status...</p>
              ) : (
                <>
                  {activationActive ? (
                    <p className="meka-learn-muted">
                      Your current access expires on {new Date(activation.expires_at).toLocaleDateString("en-NG")}.
                      You may redeem another unused PIN early; it adds 30 days to that expiry without losing remaining days.
                    </p>
                  ) : (
                    <p className="meka-learn-muted">
                      {activation?.expires_at ? "Your previous access has expired. " : "Your learner account is free. "}
                      Redeeming one valid PIN will unlock 30 days of full CBT access once the mock content launches.
                    </p>
                  )}
                  <form className="meka-learn-activation-form" onSubmit={redeemActivationPin}>
                    <label>One-time activation PIN
                      <input type="text" maxLength={48} required value={activationPin}
                        onChange={(event) => setActivationPin(event.target.value.toUpperCase())}
                        autoComplete="off" placeholder="MEKA-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
                    </label>
                    <button className="meka-learn-primary" type="submit" disabled={activating}>
                      {activating ? "Validating..." : activationActive ? "Renew with another PIN" : "Activate for 30 days"}
                    </button>
                  </form>
                  <p className="meka-learn-muted">
                    Online checkout is not part of this manual-payment version.
                    Each PIN works only once and activates one learner account.
                    OPay transaction screenshots alone are not confirmation, and renewal never resets your practice history.
                  </p>
                </>
              )}
            </section>
            <CBTTopicPractice activationActive={activationActive} />
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
