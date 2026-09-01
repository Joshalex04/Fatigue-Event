import { useState } from "react";
import fatigueLogoAsset from "@/assets/fatigue-logo.jpg.asset.json";

export function SignInScreen({
  onSignIn,
}: {
  onSignIn: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    setError(null);
    onSignIn(name, "");
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="aur absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[110px]" />
        <div
          className="aur absolute -right-24 bottom-0 h-[460px] w-[460px] rounded-full bg-accent/20 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
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


        {error ? (
          <p className="mt-3 font-mono text-xs text-destructive">{error}</p>
        ) : null}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 font-mono text-sm font-semibold text-primary-foreground ring-1 ring-primary/50 transition-transform hover:-translate-y-px"
        >
          ENTER
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          No password required. Your name stays on this device and stamps the events you save.
        </p>
      </form>
    </div>
  );
}
