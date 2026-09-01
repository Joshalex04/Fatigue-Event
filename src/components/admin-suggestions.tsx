import { useEffect, useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import { readSuggestions, writeSuggestions, type Suggestion } from "@/components/suggestion-box";

export function AdminSuggestions() {
  const { isAdmin, unlock, lock } = useAdmin();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (isAdmin) setItems(readSuggestions());
  }, [isAdmin]);

  const persist = (next: Suggestion[]) => {
    setItems(next);
    writeSuggestions(next);
  };

  if (!isAdmin) {
    return (
      <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
        <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <Lock className="size-3.5" /> Admin · Suggestions
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(!unlock(code));
            setCode("");
          }}
          className="flex gap-2"
        >
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Admin code"
            className="min-w-0 flex-1 rounded-lg bg-field px-3 py-2 font-mono text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            className="rounded-lg bg-secondary/40 px-3 py-2 font-mono text-xs font-semibold uppercase ring-1 ring-border hover:-translate-y-px"
          >
            Unlock
          </button>
        </form>
        {error ? <p className="mt-2 font-mono text-xs text-destructive">Wrong code.</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          Admin · Suggestions · {items.length}
        </p>
        <div className="flex items-center gap-3">
          {items.length > 0 ? (
            <button
              type="button"
              onClick={() => persist([])}
              className="font-mono text-[11px] text-muted-foreground uppercase hover:text-destructive"
            >
              Clear all
            </button>
          ) : null}
          <button
            type="button"
            onClick={lock}
            className="font-mono text-[11px] text-muted-foreground uppercase hover:text-foreground"
          >
            Lock
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-field/60 px-3.5 py-6 text-center text-xs text-muted-foreground ring-1 ring-border">
          No suggestions submitted yet.
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-2 rounded-xl bg-field/60 px-3 py-2 text-sm ring-1 ring-border"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words">{s.text}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                  {s.author ? `${s.author} · ` : ""}
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                aria-label="Delete suggestion"
                onClick={() => persist(items.filter((i) => i.id !== s.id))}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
