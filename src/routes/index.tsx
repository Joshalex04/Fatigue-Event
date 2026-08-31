import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BID_STATUS_OPTIONS,
  calculateFatigue,
  entriesToText,
  parseHhmm,
  type BidStatus,
} from "@/lib/fatigue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fatigue Event Calculator | Crew Ops" },
      {
        name: "description",
        content:
          "Calculate airline crew fatigue events from bid status, sign-in, fatigue call and back-for-duty times, and get the exact entries to key in.",
      },
      { property: "og:title", content: "Fatigue Event Calculator | Crew Ops" },
      {
        property: "og:description",
        content:
          "Calculate airline crew fatigue events and generate the required scheduling and pay entries.",
      },
    ],
  }),
  component: Index,
});

const fieldWrap =
  "flex items-center gap-2 rounded-lg bg-field px-3 py-2.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/40";
const fieldInput =
  "w-full min-w-0 bg-transparent font-mono text-lg text-foreground outline-none";
const labelCls =
  "block font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2";

function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Format up-to-4 raw digits as dd/mm for display. */
function formatDdMmSlash(value: string) {
  const d = digits(value, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Format up-to-4 raw digits as hh:mm military time for display. */
function formatHhMmColon(value: string) {
  const d = digits(value, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

function parseDdmm(ddmm: string): Date | undefined {
  const raw = ddmm.replace(/\D/g, "");
  if (!/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])$/.test(raw)) return undefined;
  const day = Number(raw.slice(0, 2));
  const month = Number(raw.slice(2)) - 1;
  const now = new Date();
  return new Date(now.getFullYear(), month, day);
}

function Index() {
  const [bidStatus, setBidStatus] = useState<BidStatus>("RSV_PR_OG");
  const [timeOfFatigue, setTimeOfFatigue] = useState("2340");
  const [signInTime, setSignInTime] = useState("2215");
  const [backForDutyDate, setBackForDutyDate] = useState("05/12");
  const [backForDutyTime, setBackForDutyTime] = useState("0730");
  const [femCompleted, setFemCompleted] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      calculateFatigue({
        bidStatus,
        timeOfFatigue: timeOfFatigue.replace(/\D/g, ""),
        signInTime: signInTime.replace(/\D/g, ""),
        backForDutyDate: backForDutyDate.replace(/\D/g, ""),
        backForDutyTime: backForDutyTime.replace(/\D/g, ""),
        femCompleted,
      }),
    [bidStatus, timeOfFatigue, signInTime, backForDutyDate, backForDutyTime, femCompleted],
  );

  // Whether the fatigue call happened before or after the sign-in time.
  const fatigueRelative = useMemo(() => {
    const si = parseHhmm(signInTime.replace(/\D/g, ""));
    const tf = parseHhmm(timeOfFatigue.replace(/\D/g, ""));
    if (si === null || tf === null) return null;
    return tf < si ? "Before Sign in" : "After Sign in";
  }, [signInTime, timeOfFatigue]);

  const recalcKey = `${bidStatus}${timeOfFatigue}${signInTime}${backForDutyDate}${backForDutyTime}${femCompleted}`;

  const copy = async () => {
    await navigator.clipboard.writeText(entriesToText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="aur absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[110px]" />
        <div
          className="aur absolute top-1/3 -right-28 h-[460px] w-[460px] rounded-full bg-accent/20 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="aur absolute -bottom-20 left-1/3 h-[420px] w-[420px] rounded-full bg-warning/10 blur-[120px]"
          style={{ animationDelay: "-11s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-5 sm:px-8 sm:py-7">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
              <span className="font-mono text-sm font-semibold text-primary">FE</span>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
                Meridian Ops
              </p>
              <h1 className="max-w-[40ch] font-mono text-lg font-semibold tracking-tight text-balance">
                Fatigue Event Calculator
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="inline-flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-1.5 ring-1 ring-border">
              <span className="size-1.5 rounded-full bg-primary" />
              {result.scenarioId}
            </span>
            <span className="hidden items-center gap-2 rounded-md bg-secondary/40 px-3 py-1.5 text-muted-foreground ring-1 ring-border sm:inline-flex">
              Crew Ops Desk
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6 lg:col-span-7">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                Checklist · Inputs
              </p>
              <span className="font-mono text-[11px] text-muted-foreground">01 / 02</span>
            </div>

            <div className="space-y-5">
              <div>
                <span className={labelCls}>Bid Status</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {BID_STATUS_OPTIONS.map((option) => {
                    const active = option.value === bidStatus;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBidStatus(option.value)}
                        className={
                          active
                            ? "rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary/50"
                            : "rounded-lg bg-secondary/30 px-3 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="fatigue">
                    Time of Fatigue
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">FTG</span>
                    <input
                      id="fatigue"
                      inputMode="numeric"
                      className={fieldInput}
                      value={timeOfFatigue}
                      onChange={(e) => setTimeOfFatigue(digits(e.target.value, 4))}
                    />
                    <span className="font-mono text-xs text-muted-foreground">hhmm</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="signin">
                    Sign-in Time
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">SI</span>
                    <input
                      id="signin"
                      inputMode="numeric"
                      className={fieldInput}
                      value={signInTime}
                      onChange={(e) => setSignInTime(formatHhMmColon(e.target.value))}
                    />
                    <span className="font-mono text-xs text-muted-foreground">hh:mm</span>
                  </div>
                </div>
              </div>

              <div>
                <span className={labelCls}>Back for Duty</span>
                <div className={`${fieldWrap} sm:max-w-xs`}>
                  <span className="font-mono text-xs text-primary/70">Date</span>
                  <input
                    aria-label="Back for duty date"
                    inputMode="numeric"
                    className={fieldInput}
                    value={backForDutyDate}
                    onChange={(e) => setBackForDutyDate(formatDdMmSlash(e.target.value))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">dd/mm</span>
                  <span className="h-4 w-px bg-border" />
                  <input
                    aria-label="Back for duty time"
                    inputMode="numeric"
                    className={fieldInput}
                    value={backForDutyTime}
                    onChange={(e) => setBackForDutyTime(formatHhMmColon(e.target.value))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">hh:mm</span>
                  <span className="h-4 w-px bg-border" />
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Pick back for duty date from calendar"
                        className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-primary/10"
                      >
                        <CalendarIcon className="size-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={parseDdmm(backForDutyDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setBackForDutyDate(format(date, "dd/MM"));
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <span className={labelCls}>FEM Completed</span>
                <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                  <button
                    type="button"
                    onClick={() => setFemCompleted(true)}
                    className={
                      femCompleted
                        ? "rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary/50"
                        : "rounded-lg bg-secondary/30 px-3 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-border"
                    }
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFemCompleted(false)}
                    className={
                      femCompleted
                        ? "rounded-lg bg-secondary/30 px-3 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-border"
                        : "rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive ring-1 ring-destructive/40"
                    }
                  >
                    No
                  </button>
                </div>

                {result.blockReason ? (
                  <div className="mt-3 flex items-start gap-3 rounded-lg bg-destructive/[0.08] px-3.5 py-3 ring-1 ring-destructive/30">
                    <span className="mt-0.5 shrink-0 font-mono text-sm font-bold text-destructive">
                      !
                    </span>
                    <div>
                      <p className="text-sm leading-relaxed text-destructive/90">
                        {result.blockReason}
                      </p>
                      {result.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 font-mono text-xs text-destructive/80">
                          {result.errors.map((error) => (
                            <li key={error}>· {error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-5 lg:col-span-5">
            <div
              key={recalcKey}
              className="recalc rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Result · Scenario
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">02 / 02</span>
              </div>
              <div className="rounded-xl bg-field/60 p-4 ring-1 ring-border">
                <p className="font-mono text-[11px] tracking-[0.15em] text-primary uppercase">
                  Matched Scenario
                </p>
                <p className="mt-1 max-w-[30ch] font-mono text-2xl font-semibold tracking-tight text-balance">
                  {result.scenarioId} · {result.scenarioTitle}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Duty Time
                    </p>
                    <p className="font-mono text-lg font-semibold text-primary">
                      {result.eventNumber}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Fatigue HRS
                    </p>
                    <p className="font-mono text-lg font-semibold">{result.payHours}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Status
                    </p>
                    <p
                      className={
                        result.status === "CLEAR"
                          ? "font-mono text-lg font-semibold text-primary"
                          : result.status === "HOLD"
                            ? "font-mono text-lg font-semibold text-warning"
                            : "font-mono text-lg font-semibold text-destructive"
                      }
                    >
                      {result.status}
                    </p>
                  </div>
                </div>
                {result.notes ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {result.notes}
                  </p>
                ) : null}
                {fatigueRelative ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 ring-1 ring-border">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Fatigue
                    </span>
                    <span
                      className={
                        fatigueRelative === "Before Sign in"
                          ? "font-mono text-sm font-semibold text-warning"
                          : "font-mono text-sm font-semibold text-primary"
                      }
                    >
                      {fatigueRelative}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Required Entries
                </p>
                <button
                  type="button"
                  onClick={copy}
                  disabled={result.entries.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary/50 transition-transform hover:-translate-y-px disabled:opacity-40"
                >
                  <span className="font-mono text-xs">{copied ? "COPIED" : "COPY"}</span>
                </button>
              </div>
              <div className="divide-y divide-border rounded-xl bg-field/60 font-mono text-sm ring-1 ring-border">
                {result.entries.length === 0 ? (
                  <p className="px-3.5 py-6 text-center text-xs text-muted-foreground">
                    No entries — resolve the inputs above.
                  </p>
                ) : (
                  result.entries.map((entry, i) => (
                    <div key={entry.code} className="flex items-center gap-3 px-3.5 py-3">
                      <span
                        className={
                          entry.tone === "warn"
                            ? "grid size-6 shrink-0 place-items-center rounded bg-warning/15 text-xs font-semibold text-warning"
                            : "grid size-6 shrink-0 place-items-center rounded bg-primary/15 text-xs font-semibold text-primary"
                        }
                      >
                        {i + 1}
                      </span>
                      <span
                        className={
                          entry.tone === "warn" ? "font-medium text-warning" : "font-medium"
                        }
                      >
                        {entry.code}
                      </span>
                      <span className="ml-auto text-muted-foreground">{entry.value}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Enter codes, dates and durations exactly as listed. Scenario re-computes on every
                field change.
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="tracking-[0.2em] uppercase">Internal tool · Crew Scheduling</span>
          <span>Rules v0.9 · placeholder thresholds</span>
        </footer>
      </div>
    </div>
  );
}
