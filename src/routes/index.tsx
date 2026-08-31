import { createFileRoute } from "@tanstack/react-router";
import fatigueLogoAsset from "@/assets/fatigue-logo.jpg.asset.json";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BID_STATUS_OPTIONS,
  CONDITION_OPTIONS,
  calculateFatigue,
  entriesToText,
  parseHhmm,
  type BidStatus,
  type ConditionId,
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

interface SavedEvent {
  id: string;
  savedAt: string;
  schedulerName?: string | undefined;
  bidStatus: BidStatus;
  eventDate: string;
  timeOfFatigue: string;
  signInTime: string;
  backForDutyDate: string;
  backForDutyTime: string;
  femCompleted: boolean;
  conditions?: ConditionId[];
  payHours: string;
  eventNumber: string;
  status: string;
  entries: string;
  rejoinSequence: boolean | null;
}

const STORAGE_KEY = "fatigue-events-v1";

function Index() {
  const [bidStatus, setBidStatus] = useState<BidStatus>("RSV_PR_OG");
  const [schedulerName, setSchedulerName] = useState(() => {
    try {
      return localStorage.getItem("fatigue-scheduler-name") ?? "";
    } catch {
      return "";
    }
  });
  const [eventDate, setEventDate] = useState(() => format(new Date(), "dd/MM"));
  const [timeOfFatigue, setTimeOfFatigue] = useState("2340");
  const [signInTime, setSignInTime] = useState("2215");
  const [backForDutyDate, setBackForDutyDate] = useState("05/12");
  const [backForDutyTime, setBackForDutyTime] = useState("0730");
  const [femCompleted, setFemCompleted] = useState(false);
  const [conditions, setConditions] = useState<ConditionId[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [eventCalendarOpen, setEventCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [rejoinSequence, setRejoinSequence] = useState<boolean | null>(null);

  const toggleCondition = (id: ConditionId) =>
    setConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedEvent[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const persist = (next: SavedEvent[]) => {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const result = useMemo(
    () =>
      calculateFatigue({
        bidStatus,
        timeOfFatigue: timeOfFatigue.replace(/\D/g, ""),
        signInTime: signInTime.replace(/\D/g, ""),
        backForDutyDate: backForDutyDate.replace(/\D/g, ""),
        backForDutyTime: backForDutyTime.replace(/\D/g, ""),
        femCompleted,
        conditions,
      }),
    [
      bidStatus,
      timeOfFatigue,
      signInTime,
      backForDutyDate,
      backForDutyTime,
      femCompleted,
      conditions,
    ],
  );

  // Whether the fatigue call happened before or after the sign-in time.
  const fatigueRelative = useMemo(() => {
    const si = parseHhmm(signInTime.replace(/\D/g, ""));
    const tf = parseHhmm(timeOfFatigue.replace(/\D/g, ""));
    if (si === null || tf === null) return null;
    return tf < si ? "Before Sign in" : "After Sign in";
  }, [signInTime, timeOfFatigue]);

  const recalcKey = `${bidStatus}${timeOfFatigue}${signInTime}${backForDutyDate}${backForDutyTime}${femCompleted}${conditions.join(",")}`;

  const copy = async () => {
    await navigator.clipboard.writeText(entriesToText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const save = () => {
    if (rejoinSequence === null) {
      alert(
        "Please answer whether the pilot can rejoin the next sequence before saving.",
      );
      return;
    }
    const record: SavedEvent = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      schedulerName: schedulerName.trim() || undefined,
      bidStatus,
      eventDate,
      timeOfFatigue,
      signInTime,
      backForDutyDate,
      backForDutyTime,
      femCompleted,
      conditions,
      rejoinSequence,
      payHours: result.payHours,
      eventNumber: result.eventNumber,
      status: result.status,
      entries: entriesToText(result),
    };
    persist([record, ...saved].slice(0, 100));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  const restore = (record: SavedEvent) => {
    setBidStatus(record.bidStatus);
    setEventDate(record.eventDate);
    setTimeOfFatigue(record.timeOfFatigue);
    setSignInTime(record.signInTime);
    setBackForDutyDate(record.backForDutyDate);
    setBackForDutyTime(record.backForDutyTime);
    setFemCompleted(record.femCompleted);
    setConditions(record.conditions ?? []);
    setRejoinSequence(record.rejoinSequence ?? null);
  };

  const remove = (id: string) => persist(saved.filter((r) => r.id !== id));

  const clearForm = () => {
    setBidStatus("RSV_PR_OG");
    setEventDate(format(new Date(), "dd/MM"));
    setTimeOfFatigue("");
    setSignInTime("");
    setBackForDutyDate("");
    setBackForDutyTime("");
    setFemCompleted(false);
    setConditions([]);
    setCopied(false);
    setJustSaved(false);
  };

  const statusTone = (status: string) =>
    status === "CLEAR"
      ? "text-primary"
      : status === "HOLD"
        ? "text-warning"
        : "text-destructive";


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
            <img
              src={fatigueLogoAsset.url}
              alt="Fatigue Event Calculator logo"
              className="size-10 rounded-lg object-cover ring-1 ring-primary/30"
            />
            <div>
              <h1 className="max-w-[40ch] font-mono text-lg font-semibold tracking-tight text-balance">
                Fatigue Event
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary/40 px-3 py-1.5 text-sm font-semibold text-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
            >
              <span className="font-mono text-xs">{justSaved ? "SAVED" : "SAVE"}</span>
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary/40 px-3 py-1.5 text-sm font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
            >
              <span className="font-mono text-xs">CLEAR</span>
            </button>
            <div className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/40">
              <span className="text-muted-foreground">Scheduler</span>
              <input
                aria-label="Scheduler name"
                className="w-32 min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
                placeholder="Name"
                value={schedulerName}
                onChange={(e) => {
                  setSchedulerName(e.target.value);
                  try {
                    localStorage.setItem("fatigue-scheduler-name", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6 lg:col-span-7">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                Inputs
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

              <div>
                <span className={labelCls}>Event Date</span>
                <div className={`${fieldWrap} sm:max-w-xs`}>
                  <span className="font-mono text-xs text-primary/70">Date</span>
                  <input
                    aria-label="Event date"
                    inputMode="numeric"
                    className={fieldInput}
                    value={eventDate}
                    onChange={(e) => setEventDate(formatDdMmSlash(e.target.value))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">dd/mm</span>
                  <span className="h-4 w-px bg-border" />
                  <Popover open={eventCalendarOpen} onOpenChange={setEventCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Pick event date from calendar"
                        className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-primary/10"
                      >
                        <CalendarIcon className="size-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={parseDdmm(eventDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setEventDate(format(date, "dd/MM"));
                          setEventCalendarOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
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
                      onChange={(e) => setSignInTime(digits(e.target.value, 4))}
                    />
                    <span className="font-mono text-xs text-muted-foreground">hhmm</span>
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
                    onChange={(e) => setBackForDutyTime(digits(e.target.value, 4))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">hhmm</span>
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
                  Results
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">02 / 02</span>
              </div>
              <div className="rounded-xl bg-field/60 p-4 ring-1 ring-border">
                <div className="grid grid-cols-3 gap-3">
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
                      Back to Duty
                    </p>
                    <p className="font-mono text-lg font-semibold">
                      {backForDutyDate} {backForDutyTime}
                    </p>
                  </div>
                </div>
                {result.notes ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {result.notes}
                  </p>
                ) : null}
                {fatigueRelative ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 ring-1 ring-border">
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
                    <div className="ml-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        Can Rejoin Next Sequence?
                      </span>
                      <button
                        type="button"
                        onClick={() => setRejoinSequence(true)}
                        className={
                          rejoinSequence === true
                            ? "rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground ring-1 ring-primary/50"
                            : "rounded-md bg-secondary/40 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                        }
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejoinSequence(false)}
                        className={
                          rejoinSequence === false
                            ? "rounded-md bg-warning px-3 py-1 text-xs font-semibold text-warning-foreground ring-1 ring-warning/50"
                            : "rounded-md bg-secondary/40 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                        }
                      >
                        NO
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Conditions — each toggle adds its required entry below. */}
            <div className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Conditions
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {conditions.length} / {CONDITION_OPTIONS.length}
                </span>
              </div>
              <div className="grid gap-2 rounded-xl bg-field/60 p-3 ring-1 ring-border sm:grid-cols-2">
                {CONDITION_OPTIONS.map((option) => {
                  const active = conditions.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCondition(option.id)}
                      className={
                        active
                          ? "flex items-start gap-3 rounded-lg bg-primary/10 p-3 text-left ring-1 ring-primary/50 transition-colors"
                          : "flex items-start gap-3 rounded-lg bg-secondary/20 p-3 text-left ring-1 ring-border transition-colors hover:bg-secondary/40"
                      }
                    >
                      <span
                        className={
                          active
                            ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground"
                            : "mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-secondary/50 text-[11px] text-muted-foreground ring-1 ring-border"
                        }
                      >
                        {active ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                        <span
                          className={
                            active
                              ? "mt-1 inline-block font-mono text-[11px] text-primary"
                              : "mt-1 inline-block font-mono text-[11px] text-muted-foreground"
                          }
                        >
                          {option.code}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Each condition you turn on adds its entry to the Required Entries list below.
              </p>
            </div>


            <div className="flex-1 rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Required Entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    disabled={result.entries.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary/50 transition-transform hover:-translate-y-px disabled:opacity-40"
                  >
                    <span className="font-mono text-xs">{copied ? "COPIED" : "COPY"}</span>
                  </button>
                </div>
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


        <section className="mt-5 rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Saved Events · {saved.length}
            </p>
            {saved.length > 0 ? (
              <button
                type="button"
                onClick={() => persist([])}
                className="font-mono text-[11px] text-muted-foreground uppercase hover:text-destructive"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {saved.length === 0 ? (
            <p className="rounded-xl bg-field/60 px-3.5 py-6 text-center text-xs text-muted-foreground ring-1 ring-border">
              No saved events yet — press SAVE to store the current calculation.
            </p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl bg-field/60 font-mono text-sm ring-1 ring-border">
              {saved.map((record) => (
                <div key={record.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                  <span className="text-primary">{record.eventDate}</span>
                  {record.schedulerName ? (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary ring-1 ring-primary/30">
                      {record.schedulerName}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    SI {record.signInTime} · FTG {record.timeOfFatigue}
                  </span>
                  <span className="text-muted-foreground">
                    BFD {record.backForDutyDate} {record.backForDutyTime}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {BID_STATUS_OPTIONS.find((o) => o.value === record.bidStatus)?.label}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="text-foreground">{record.payHours}</span>
                    <span className={`text-xs font-semibold ${statusTone(record.status)}`}>
                      {record.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => restore(record)}
                      className="rounded-md bg-secondary/40 px-2.5 py-1 text-[11px] uppercase ring-1 ring-border hover:-translate-y-px"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      aria-label="Delete saved event"
                      onClick={() => remove(record.id)}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="tracking-[0.2em] uppercase">Crew Scheduling</span>
          <span className="max-w-[60ch] text-balance">Unofficial employee-developed tool. Not authorized or endorsed by American Airlines. Use at your own risk.</span>
        </footer>
      </div>
    </div>
  );
}

