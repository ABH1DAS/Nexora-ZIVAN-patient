"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createInitialUserData,
  fetchHealthProfile,
  isSupabaseConfigured,
} from "@/lib/supabase";

const STORAGE_KEY = "zivan-auth-user";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Plus" | "Family";
  phone?: string;
  bloodGroup?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredUser();
    if (stored) {
      setUser(stored);
      // Sync from Supabase in background
      if (isSupabaseConfigured) {
        fetchHealthProfile(stored.id).then((hp) => {
          if (hp) {
            const updated: AuthUser = {
              ...stored,
              name: hp.full_name || stored.name,
              bloodGroup: hp.blood_group || stored.bloodGroup,
              phone: hp.doctor_phone || stored.phone,
            };
            setUser(updated);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          }
        });
      }
    }
    setLoading(false);
  }, []);

  const persist = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("zivan-auth-user-updated", { detail: next }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("zivan-auth-user-updated", { detail: null }));
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !password) {
        return { ok: false as const, error: "Enter email and password." };
      }
      if (!normalized.includes("@")) {
        return { ok: false as const, error: "Enter a valid email address." };
      }
      if (password.length < 4) {
        return { ok: false as const, error: "Password must be at least 4 characters." };
      }

      const existing = readStoredUser();
      const userId = existing?.email === normalized ? existing.id : `user_${normalized.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const name =
        existing?.email === normalized
          ? existing.name
          : normalized.split("@")[0]?.replace(/[._]/g, " ") || "Member";

      const authUser: AuthUser = {
        id: userId,
        name: name
          .split(" ")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        email: normalized,
        plan: existing?.email === normalized ? existing.plan : "Plus",
        phone: existing?.phone || "+91 98765 43210",
        bloodGroup: existing?.bloodGroup || "O+",
      };

      persist(authUser);

      // Connect & ensure user data exists in Supabase
      if (isSupabaseConfigured) {
        createInitialUserData(authUser.id, authUser.name, authUser.email, authUser.phone);
      }

      return { ok: true as const, user: authUser };
    },
    [persist],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const trimmedName = name.trim();
      const normalized = normalizeEmail(email);
      if (!trimmedName) {
        return { ok: false as const, error: "Enter your name." };
      }
      if (!normalized.includes("@")) {
        return { ok: false as const, error: "Enter a valid email address." };
      }
      if (password.length < 4) {
        return { ok: false as const, error: "Password must be at least 4 characters." };
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newUser: AuthUser = {
        id: userId,
        name: trimmedName,
        email: normalized,
        plan: "Free",
        phone: "+91 98765 43210",
        bloodGroup: "O+",
      };

      persist(newUser);

      // Provision all connected tables in Supabase for this new user
      if (isSupabaseConfigured) {
        createInitialUserData(newUser.id, newUser.name, newUser.email, newUser.phone);
      }

      return { ok: true as const, user: newUser };
    },
    [persist],
  );

  const logout = useCallback(() => {
    persist(null);
  }, [persist]);

  const updateUser = useCallback(
    (patch: Partial<AuthUser>) => {
      const current = readStoredUser();
      if (current) {
        const next = { ...current, ...patch };
        persist(next);
      }
    },
    [persist]
  );

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, updateUser }),
    [user, loading, login, signup, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
