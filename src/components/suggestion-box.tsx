import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

interface Suggestion {
  id: string;
  text: string;
  author?: string;
  createdAt: string;
}

const KEY = "fatigue-suggestions-v1";

export function SuggestionBox({ author }: { author?: string }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as Suggestion[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const persist = (next: Suggestion[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    persist(
      [
        {
          id: `${Date.now()}`,
          text: value,
          ...(author ? { author } : {}),
          createdAt: new Date().toISOString(),
        },
        ...items,
      ].slice(0, 50),
    );
    setText("");
    setSent(true);
    setTimeout(() => setSent(false), 1600);
  };

  return (
    <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          Suggestion Box · {items.length}
        </p>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => persist([])}
            className="font-mono text-[11px] text-muted-foreground uppercase hover:text-destructive"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <form onSubmit={submit}>
        <textarea
          className="min-h-24 w-full resize-y rounded-xl bg-field px-3.5 py-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/40"
          placeholder="Ideas, missing entries, or anything to improve…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-secondary/40 px-3 py-2 font-mono text-xs font-semibold uppercase ring-1 ring-border transition-transform hover:-translate-y-px"
        >
          {sent ? "Thanks!" : "Submit suggestion"}
        </button>
      </form>

      {items.length > 0 ? (
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-2 rounded-xl bg-field/60 px-3 py-2 text-sm ring-1 ring-border"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words">{s.text}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                  {s.author ? `${s.author} · ` : ""}
                  {new Date(s.createdAt).toLocaleDateString()}
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
      ) : null}
    </section>
  );
}
