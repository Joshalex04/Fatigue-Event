import { useState } from "react";

export interface Suggestion {
  id: string;
  text: string;
  author?: string;
  createdAt: string;
}

export const SUGGESTIONS_KEY = "fatigue-suggestions-v1";

export function readSuggestions(): Suggestion[] {
  try {
    const raw = localStorage.getItem(SUGGESTIONS_KEY);
    return raw ? (JSON.parse(raw) as Suggestion[]) : [];
  } catch {
    return [];
  }
}

export function writeSuggestions(next: Suggestion[]) {
  try {
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function SuggestionBox({ author }: { author?: string }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    writeSuggestions(
      [
        {
          id: `${Date.now()}`,
          text: value,
          ...(author ? { author } : {}),
          createdAt: new Date().toISOString(),
        },
        ...readSuggestions(),
      ].slice(0, 50),
    );
    setText("");
    setSent(true);
    setTimeout(() => setSent(false), 1600);
  };

  return (
    <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
      <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        Suggestion Box
      </p>

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
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Submissions are reviewed by the administrator.
      </p>
    </section>
  );
}
