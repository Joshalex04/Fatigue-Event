import { useCallback, useEffect, useState } from "react";

export interface AppUser {
  name: string;
  phone: string;
  equipment: string[];
  signedInAt: string;
}

const SESSION_KEY = "fatigue-session-v1";

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

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
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppUser>;
        setUser({
          name: parsed.name ?? "",
          phone: parsed.phone ?? "",
          equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
          signedInAt: parsed.signedInAt ?? new Date().toISOString(),
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback((name: string, equipment: string[]) => {
    const next: AppUser = {
      name: name.trim(),
      phone: "",
      equipment,
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
