import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

const validateActiveStaffAndSchool = async (staffRecord) => {
  if (!staffRecord) {
    throw new Error("Your account is not authorized as school staff.");
  }

  if (String(staffRecord.status || "").toLowerCase() !== "active") {
    throw new Error("Your staff account is inactive. Contact a school administrator.");
  }

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, status")
    .eq("id", staffRecord.school_id)
    .maybeSingle();

  if (error) throw error;

  if (!school || String(school.status || "").toLowerCase() !== "active") {
    throw new Error("This school account is inactive. Contact the school administrator.");
  }

  return staffRecord;
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
      const activeRecord = await validateActiveStaffAndSchool(record);
      setStaff(activeRecord);
      setError("");
    } catch (err) {
      console.error("STAFF PROFILE LOAD ERROR:", err);
      setStaff(null);
      setError(err.message || "Unable to load the staff profile.");
      await supabase.auth.signOut();
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
