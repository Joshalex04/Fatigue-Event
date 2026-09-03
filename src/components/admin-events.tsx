import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import { readAllEvents, type Profile } from "@/lib/profiles";

interface AnyEvent {
  id: string;
  eventDate?: string;
  signInTime?: string;
  timeOfFatigue?: string;
  backForDutyDate?: string;
  backForDutyTime?: string;
  status?: string;
  payHours?: string;
}

export function AdminEvents() {
  const { isAdmin } = useAdmin();
  const [groups, setGroups] = useState<{ profile: Profile; events: AnyEvent[] }[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) setGroups(readAllEvents<AnyEvent>());
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
      <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        <Lock className="size-3.5" /> All Profiles
      </p>
      {groups.length === 0 ? (
        <p className="rounded-xl bg-field/60 px-3 py-4 text-center text-xs text-muted-foreground ring-1 ring-border">
          No profiles saved on this device yet.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(({ profile, events }) => (
            <div key={profile.username} className="rounded-xl bg-field/60 ring-1 ring-border">
              <button
                type="button"
                onClick={() => setOpen(open === profile.username ? null : profile.username)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 font-mono text-xs"
              >
                <span className="truncate text-foreground">{profile.displayName}</span>
                <span className="text-muted-foreground">{events.length} events</span>
              </button>
              {open === profile.username ? (
                <div className="divide-y divide-border border-t border-border font-mono text-[11px]">
                  {events.length === 0 ? (
                    <p className="px-3 py-2 text-muted-foreground">No saved events.</p>
                  ) : (
                    events.map((e) => (
                      <div key={e.id} className="flex flex-wrap gap-2 px-3 py-2">
                        <span className="text-primary">{e.eventDate}</span>
                        <span className="text-muted-foreground">
                          SI {e.signInTime} · FTG {e.timeOfFatigue}
                        </span>
                        <span className="text-muted-foreground">
                          BFD {e.backForDutyDate} {e.backForDutyTime}
                        </span>
                        <span className="ml-auto text-foreground">{e.payHours}</span>
                        <span className="text-muted-foreground">{e.status}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
