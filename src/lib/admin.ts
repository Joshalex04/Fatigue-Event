import { useCallback, useEffect, useState } from "react";

const ADMIN_KEY = "fatigue-admin-v1";
/** Passcode that unlocks the admin suggestions panel. */
export const ADMIN_CODE = "FTG-ADMIN";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      setIsAdmin(localStorage.getItem(ADMIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const unlock = useCallback((code: string) => {
    if (code.trim().toUpperCase() !== ADMIN_CODE) return false;
    setIsAdmin(true);
    try {
      localStorage.setItem(ADMIN_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const lock = useCallback(() => {
    setIsAdmin(false);
    try {
      localStorage.removeItem(ADMIN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { isAdmin, unlock, lock };
}
