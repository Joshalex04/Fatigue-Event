/**
 * Per-username profile storage.
 *
 * Each username owns its own bucket of saved events. A regular user only ever
 * reads/writes their own bucket; the administrator can read every bucket.
 */

const EVENTS_BY_USER_KEY = "fatigue-events-by-user-v1";
const PROFILES_KEY = "fatigue-profiles-v1";
const LEGACY_EVENTS_KEY = "fatigue-events-v1";

export interface Profile {
  /** Normalized key used for storage. */
  username: string;
  /** Name exactly as typed at sign-in. */
  displayName: string;
  equipment: string[];
  createdAt: string;
}

/** Username key derived from a person's name (case/space insensitive). */
export function usernameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export function listProfiles(): Profile[] {
  return read<Profile[]>(PROFILES_KEY, []);
}

/** Creates the profile if it does not exist yet, otherwise refreshes it. */
export function upsertProfile(name: string, equipment: string[]): Profile {
  const username = usernameKey(name);
  const profiles = listProfiles();
  const existing = profiles.find((p) => p.username === username);
  const next: Profile = {
    username,
    displayName: name.trim(),
    equipment,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  write(PROFILES_KEY, [next, ...profiles.filter((p) => p.username !== username)]);
  return next;
}

type EventMap = Record<string, unknown[]>;

function readMap(): EventMap {
  return read<EventMap>(EVENTS_BY_USER_KEY, {});
}

/** Events belonging to one username only. */
export function readUserEvents<T>(name: string): T[] {
  const username = usernameKey(name);
  const map = readMap();
  if (!map[username]) {
    // One-time migration of pre-profile events into the first signed-in user.
    const legacy = read<T[]>(LEGACY_EVENTS_KEY, []);
    if (legacy.length > 0) {
      writeUserEvents(name, legacy);
      try {
        localStorage.removeItem(LEGACY_EVENTS_KEY);
      } catch {
        /* ignore */
      }
      return legacy;
    }
  }
  return (map[username] ?? []) as T[];
}

export function writeUserEvents<T>(name: string, events: T[]) {
  const map = readMap();
  map[usernameKey(name)] = events as unknown[];
  write(EVENTS_BY_USER_KEY, map);
}

/** Administrator-only: every profile's events. */
export function readAllEvents<T>(): { profile: Profile; events: T[] }[] {
  const map = readMap();
  const profiles = listProfiles();
  const keys = Array.from(new Set([...profiles.map((p) => p.username), ...Object.keys(map)]));
  return keys.map((username) => ({
    profile:
      profiles.find((p) => p.username === username) ??
      { username, displayName: username, equipment: [], createdAt: "" },
    events: (map[username] ?? []) as T[],
  }));
}
