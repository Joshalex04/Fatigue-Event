import { useCallback, useEffect, useState } from "react";

export interface AppUser {
  name: string;
  phone: string;
  signedInAt: string;
}

const SESSION_KEY = "fatigue-session-v1";

/** Normalize a phone number to digits only (max 15, E.164-ish length). */
export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

/** Display helper: (305) 555-1234 for 10-digit US numbers, raw digits otherwise. */
export function formatPhone(value: string) {
  const d = normalizePhone(value);
  if (d.length !== 10) return d;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function useSession() {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw) as AppUser);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback((name: string, phone: string) => {
    const next: AppUser = {
      name: name.trim(),
      phone: normalizePhone(phone),
      signedInAt: new Date().toISOString(),
    };
    setUser(next);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { hydrated, user, signIn, signOut };
}
