import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AUTH_REDIRECT_URL = "https://mekaschool.vercel.app";

const AuthContext = createContext(null);

const getStaffRecord = async (userId) => {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, auth_user_id, first_name, middle_name, last_name, role, status, school_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSession = async (nextSession) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setStaff(null);
      setError("");
      setLoading(false);
      return;
    }

    try {
      if (!nextSession.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setStaff(null);
        setSession(null);
        setError("Your email address must be verified before you can sign in.");
        return;
      }

      const record = await getStaffRecord(nextSession.user.id);
      setStaff(record);
      setError("");
    } catch (err) {
      console.error("STAFF PROFILE LOAD ERROR:", err);
      setStaff(null);
      setError(err.message || "Unable to load the staff profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      loadSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (mounted) loadSession(nextSession);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      const verificationError = new Error(
        "Your email address must be verified before you can sign in. Check your email for the verification link."
      );
      setError(verificationError.message);
      throw verificationError;
    }
  };

  const resendVerification = async (email) => {
    setError("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
      },
    });

    if (resendError) {
      setError(resendError.message);
      throw resendError;
    }
  };

  const signUp = async ({ email, password, schoolName, firstName, lastName }) => {
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: {
          school_name: schoolName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }

    return data;
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  };

  const isAdmin = staff?.role?.toLowerCase() === "admin";
  const isAttendanceOnly = staff?.role?.toLowerCase() === "attendance";

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      staff,
      loading,
      error,
      signIn,
      resendVerification,
      signUp,
      signOut,
      isAdmin,
      isAttendanceOnly,
    }),
    [session, staff, loading, error, isAdmin, isAttendanceOnly]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
