import { useState } from "react";
import fatigueLogoAsset from "@/assets/fatigue-logo.jpg.asset.json";

const EQUIPMENT_OPTIONS = ["320", "737", "777", "787"];

export function SignInScreen({
  onSignIn,
  profiles = [],
}: {
  onSignIn: (name: string, equipment: string[]) => void;
  /** Usernames already created on this device. */
  profiles?: string[];
}) {
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleEquipment = (value: string) => {
    setEquipment((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (equipment.length === 0) {
      setError("Select at least one airplane equipment type.");
      return;
    }
    setError(null);
    onSignIn(name, equipment);
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="aur absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[110px]" />
        <div className="aur absolute -right-24 bottom-0 h-[460px] w-[460px] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl bg-panel/50 p-6 ring-1 ring-border backdrop-blur-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={fatigueLogoAsset.url}
            alt="Fatigue Event logo"
            className="size-20 rounded-xl object-cover ring-1 ring-primary/30"
          />
          <h1 className="mt-3 font-mono text-xl font-semibold tracking-tight">Fatigue Event</h1>
          <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            Sign in
          </p>
        </div>

        <label className="block font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
          Name
        </label>
        <input
          className="mt-2 w-full rounded-lg bg-field px-3 py-2.5 font-mono text-base outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/40"
          placeholder="First Last"
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />

        {profiles.length > 0 ? (
          <div className="mt-3">
            <span className="block font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Existing usernames
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <button
                  key={profile}
                  type="button"
                  onClick={() => setName(profile)}
                  className="rounded-lg bg-secondary/30 px-2.5 py-1.5 font-mono text-xs ring-1 ring-border hover:-translate-y-px"
                >
                  {profile}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <span className="mt-5 block font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
          Airplane Equipment
        </span>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {EQUIPMENT_OPTIONS.map((value) => {
            const selected = equipment.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleEquipment(value)}
                className={
                  selected
                    ? "rounded-lg bg-primary px-2 py-2.5 font-mono text-sm font-semibold text-primary-foreground ring-1 ring-primary/50"
                    : "rounded-lg bg-secondary/30 px-2 py-2.5 font-mono text-sm font-medium text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                }
              >
                {value}
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          Select every equipment type you work with.
        </p>

        {error ? <p className="mt-3 font-mono text-xs text-destructive">{error}</p> : null}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 font-mono text-sm font-semibold text-primary-foreground ring-1 ring-primary/50 transition-transform hover:-translate-y-px"
        >
          ENTER
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          No password required. Your name is your username — saved events are private to it.
        </p>
      </form>
    </div>
  );
}
