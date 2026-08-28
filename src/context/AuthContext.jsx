import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const getStaffRecord = async (userId) => {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, auth_user_id, first_name, middle_name, last_name, role, status")
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      staff,
      loading,
      error,
      signIn,
      signOut,
      isAdmin: staff?.role?.toLowerCase() === "admin",
    }),
    [session, staff, loading, error]
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
