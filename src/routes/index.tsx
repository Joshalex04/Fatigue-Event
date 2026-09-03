import { createFileRoute } from "@tanstack/react-router";
import fatigueLogoAsset from "@/assets/fatigue-logo.jpg.asset.json";
import skyBgAsset from "@/assets/sky-bg.jpg.asset.json";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession } from "@/lib/session";
import { SignInScreen } from "@/components/sign-in-screen";
import { PlaneSplash } from "@/components/plane-splash";
import { SuggestionBox } from "@/components/suggestion-box";
import { AdminSuggestions } from "@/components/admin-suggestions";
import { AdminEvents } from "@/components/admin-events";
import { listProfiles, readUserEvents, upsertProfile, writeUserEvents } from "@/lib/profiles";
import {
  BID_STATUS_OPTIONS,
  CSS_CALENDAR_URL,
  CSS_CREW_URL,
  buildEntriesPlan,
  calculateFatigue,
  ddmmToDdMmm,
  dutyElapsedOnDates,
  formatMinutes,
  isFatigueBeforeSignIn,
  planToText,
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Fatigue Event Calculator | Crew Ops" },
      {
        name: "twitter:description",
        content: "Generate airline fatigue-event entries and workflow steps from crew inputs.",
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

const AIRPORT_BASES = ["MIA", "LAX", "DCA", "DFW", "ORD", "PHL", "PHX", "CLT", "LGA", "BOS"];

function stepTextWithLink(text: string): ReactNode {
  const url = text.includes(CSS_CALENDAR_URL)
    ? CSS_CALENDAR_URL
    : text.includes(CSS_CREW_URL)
      ? CSS_CREW_URL
      : null;
  if (!url) return text;
  const [before, after = ""] = text.split(url);
  return (
    <>
      {before}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {url}
      </a>
      {after}
    </>
  );
}


interface SavedEvent {
  id: string;
  savedAt: string;
  schedulerName?: string | undefined;
  bidStatus: BidStatus;
  eventDate: string;
  airportBase?: string;
  employeeNumber?: string;
  sequenceNumber?: string;
  sequenceDate?: string;
  timeOfFatigue: string;
  signInTime: string;
  signInDate?: string;
  backForDutyDate: string;
  backForDutyTime: string;
  femCompleted: boolean;
  recoveryObligation?: boolean | null;
  conditions?: ConditionId[];
  payHours: string;
  eventNumber: string;
  status: string;
  entries: string;
  rejoinSequence: boolean | null;
  rapStarted?: boolean | null;
  recoveryFlying?: boolean | null;
  equipment?: string;
}



function Index() {
  const { hydrated, user, signIn, signOut } = useSession();
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [bidStatus, setBidStatus] = useState<BidStatus>("RSV_PR_OG");
  const [splash, setSplash] = useState(false);
  const [schedulerName, setSchedulerName] = useState(() => {
    try {
      return localStorage.getItem("fatigue-scheduler-name") ?? "";
    } catch {
      return "";
    }
  });
  const [eventDate, setEventDate] = useState(() => format(new Date(), "dd/MM"));
  const [airportBase, setAirportBase] = useState("MIA");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [sequenceNumber, setSequenceNumber] = useState("");
  const [sequenceDate, setSequenceDate] = useState(() => format(new Date(), "dd/MM"));
  const [timeOfFatigue, setTimeOfFatigue] = useState("2340");
  const [signInTime, setSignInTime] = useState("2215");
  const [signInDate, setSignInDate] = useState(() => format(new Date(), "dd/MM"));
  const [backForDutyDate, setBackForDutyDate] = useState("05/12");
  const [backForDutyTime, setBackForDutyTime] = useState("0730");
  const [femCompleted, setFemCompleted] = useState(false);
  const [conditions, setConditions] = useState<ConditionId[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [eventCalendarOpen, setEventCalendarOpen] = useState(false);
  const [signInCalendarOpen, setSignInCalendarOpen] = useState(false);
  const [sequenceCalendarOpen, setSequenceCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [rejoinSequence, setRejoinSequence] = useState<boolean | null>(null);
  const [rapStarted, setRapStarted] = useState<boolean | null>(null);
  const [recoveryFlying, setRecoveryFlying] = useState<boolean | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);

  // Saved events are scoped to the signed-in username.
  useEffect(() => {
    if (!user?.name) {
      setSaved([]);
      return;
    }
    setSaved(readUserEvents<SavedEvent>(user.name));
  }, [user?.name]);

  const persist = (next: SavedEvent[]) => {
    setSaved(next);
    if (user?.name) writeUserEvents<SavedEvent>(user.name, next);
  };

  const result = useMemo(
    () =>
      calculateFatigue({
        bidStatus,
        timeOfFatigue: timeOfFatigue.replace(/\D/g, ""),
        signInTime: signInTime.replace(/\D/g, ""),
        eventDate: eventDate.replace(/\D/g, ""),
        signInDate: signInDate.replace(/\D/g, ""),
        backForDutyDate: backForDutyDate.replace(/\D/g, ""),
        backForDutyTime: backForDutyTime.replace(/\D/g, ""),
        femCompleted,
        conditions,
      }),
    [
      bidStatus,
      timeOfFatigue,
      signInTime,
      eventDate,
      signInDate,
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
    return isFatigueBeforeSignIn(
      si,
      tf,
      signInDate.replace(/\D/g, ""),
      eventDate.replace(/\D/g, ""),
    ) ? "Before Sign in" : "After Sign in";
  }, [signInTime, timeOfFatigue, signInDate, eventDate]);

  // Duty runs from sign-in until fatigue. A fatigue call before sign-in is no duty.
  const dutyTimeDisplay = useMemo(() => {
    const si = parseHhmm(signInTime.replace(/\D/g, ""));
    const tf = parseHhmm(timeOfFatigue.replace(/\D/g, ""));
    if (si === null || tf === null) return "--";
    if (isFatigueBeforeSignIn(
      si,
      tf,
      signInDate.replace(/\D/g, ""),
      eventDate.replace(/\D/g, ""),
    )) return "NO DUTY";
    return formatMinutes(dutyElapsedOnDates(
      si,
      tf,
      signInDate.replace(/\D/g, ""),
      eventDate.replace(/\D/g, ""),
    ));
  }, [signInTime, timeOfFatigue, signInDate, eventDate]);

  // Fatigue HRS: hours the pilot is fatigued — time of fatigue until back for duty.
  const fatigueHrsDisplay = result.fatigueHours;

  // Back-for-duty date as DDMMM (e.g. 01SEP).
  const backForDutyDisplay = useMemo(() => {
    const d = ddmmToDdMmm(backForDutyDate.replace(/\D/g, ""));
    const t = backForDutyTime.replace(/\D/g, "");
    return `${d ?? backForDutyDate}${t ? ` ${t}` : ""}`;
  }, [backForDutyDate, backForDutyTime]);

  const plan = useMemo(
    () =>
      buildEntriesPlan({
        bidStatus,
        priorSignIn:
          fatigueRelative === null ? null : fatigueRelative === "Before Sign in",
        rejoinSequence,
        rapStarted,
        recoveryFlying,
        employeeNumber,
        sequenceNumber,
        sequenceDate: sequenceDate.replace(/\D/g, ""),
        eventDate: eventDate.replace(/\D/g, ""),
        timeOfFatigue: timeOfFatigue.replace(/\D/g, ""),
        signInTime: signInTime.replace(/\D/g, ""),
        signInDate: signInDate.replace(/\D/g, ""),
        backForDutyDate: backForDutyDate.replace(/\D/g, ""),
        backForDutyTime: backForDutyTime.replace(/\D/g, ""),
        airportBase,
        equipment: selectedEquipment,
      }),
    [
      bidStatus,
      fatigueRelative,
      rejoinSequence,
      rapStarted,
      recoveryFlying,
      employeeNumber,
      sequenceNumber,
      sequenceDate,
       eventDate,
       timeOfFatigue,
       signInTime,
       signInDate,
       backForDutyDate,
       backForDutyTime,
       airportBase,
       selectedEquipment,
    ],
  );

  const recalcKey = `${bidStatus}${eventDate}${airportBase}${employeeNumber}${sequenceNumber}${sequenceDate}${timeOfFatigue}${signInTime}${backForDutyDate}${backForDutyTime}${femCompleted}${rejoinSequence}${rapStarted}${recoveryFlying}${selectedEquipment}${conditions.join(",")}`;

  useEffect(() => {
    setReminderVisible(false);
    if (!plan.ready || plan.entries.length === 0 || result.blocked) return;
    const timer = window.setTimeout(() => setReminderVisible(true), 120_000);
    return () => window.clearTimeout(timer);
  }, [plan.ready, plan.entries.length, result.blocked, recalcKey]);

  const copy = async () => {
    // Copy only the entry codes, one per line (e.g. HE/5555/01/25/MI).
    await navigator.clipboard.writeText(plan.entries.map((e) => e.code).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const save = () => {
    if (rejoinSequence === null) {
      alert(
        "Please answer whether the pilot can rejoin the sequence before saving.",
      );
      return;
    }
    const record: SavedEvent = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      schedulerName: schedulerName.trim() || undefined,
      bidStatus,
      eventDate,
      airportBase,
      employeeNumber,
      sequenceNumber,
      sequenceDate,
      timeOfFatigue,
      signInTime,
      signInDate,
      backForDutyDate,
      backForDutyTime,
      femCompleted,
      
      conditions,
      rejoinSequence,
      rapStarted,
      recoveryFlying,
      equipment: selectedEquipment,
      payHours: result.payHours,
      eventNumber: result.eventNumber,
      status: result.status,
      entries: planToText(plan),
    };
    persist([record, ...saved].slice(0, 100));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  const restore = (record: SavedEvent) => {
    setBidStatus(record.bidStatus);
    setEventDate(record.eventDate);
    setAirportBase(record.airportBase ?? "MIA");
    setEmployeeNumber(record.employeeNumber ?? "");
    setSequenceNumber(record.sequenceNumber ?? "");
    setSequenceDate(record.sequenceDate ?? "");
     setTimeOfFatigue(record.timeOfFatigue);
     setSignInTime(record.signInTime);
     setSignInDate(record.signInDate ?? record.eventDate);
     setBackForDutyDate(record.backForDutyDate);
     setBackForDutyTime(record.backForDutyTime);
    setFemCompleted(record.femCompleted);
    setConditions(record.conditions ?? []);
    setRejoinSequence(record.rejoinSequence ?? null);
    setRapStarted(record.rapStarted ?? null);
    setRecoveryFlying(record.recoveryFlying ?? null);
  };

  const remove = (id: string) => persist(saved.filter((r) => r.id !== id));

  const clearForm = () => {
    setBidStatus("RSV_PR_OG");
    setEventDate(format(new Date(), "dd/MM"));
    setAirportBase("MIA");
    setEmployeeNumber("");
    setSequenceNumber("");
     setSequenceDate(format(new Date(), "dd/MM"));
     setTimeOfFatigue("");
     setSignInTime("");
     setSignInDate(format(new Date(), "dd/MM"));
     setBackForDutyDate("");
     setBackForDutyTime("");
    setFemCompleted(false);
    setConditions([]);
    setRejoinSequence(null);
    setRapStarted(null);
    setRecoveryFlying(null);
    setCopied(false);
    setJustSaved(false);
  };


  const statusTone = (status: string) =>
    status === "CLEAR"
      ? "text-primary"
      : status === "HOLD"
        ? "text-warning"
        : "text-destructive";

  const signOutAndClear = () => {
    clearForm();
    setSchedulerName("");
    setSelectedEquipment("");
    try {
      localStorage.removeItem("fatigue-scheduler-name");
    } catch {
      /* ignore */
    }
    signOut();
  };

  if (!hydrated) return null;
  if (!user) {
    return (
      <SignInScreen
        profiles={listProfiles().map((p) => p.displayName)}
        onSignIn={(name, equipment) => {
          upsertProfile(name, equipment);
          signIn(name, equipment);
          setSchedulerName(name.trim());
          setSelectedEquipment(equipment[0] ?? "");
          try {
            localStorage.setItem("fatigue-scheduler-name", name.trim());
          } catch {
            /* ignore */
          }
          setSplash(true);
        }}
      />
    );
  }

  if (splash) {
    return <PlaneSplash onDone={() => setSplash(false)} />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${skyBgAsset.url})` }}
        />
        <div className="absolute inset-0 bg-background/80" />
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
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
            <div className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-1.5 ring-1 ring-border">
              <span className="text-muted-foreground">EQ</span>
              {user.equipment.length > 1 ? (
                <select
                  aria-label="Equipment for this fatigue event"
                  className="w-16 bg-transparent font-mono text-foreground outline-none"
                  value={selectedEquipment}
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                >
                  {user.equipment.map((equipment) => (
                    <option key={equipment} value={equipment} className="bg-background">
                      {equipment}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-foreground">{user.equipment[0] ?? "—"}</span>
              )}
            </div>
            <button
              type="button"
              onClick={signOutAndClear}
              className="rounded-md bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase ring-1 ring-border transition-transform hover:-translate-y-px"
            >
              Sign out
            </button>
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
                  <label className={labelCls} htmlFor="airport-base">
                    Airport Base
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">BASE</span>
                    <select
                      id="airport-base"
                      className={`${fieldInput} appearance-none`}
                      value={airportBase}
                      onChange={(e) => setAirportBase(e.target.value)}
                    >
                      {AIRPORT_BASES.map((code) => (
                        <option key={code} value={code} className="bg-background">
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="employee-number">
                    Employee #
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">EMP</span>
                    <input
                      id="employee-number"
                      inputMode="numeric"
                      placeholder="000000"
                      className={`${fieldInput} placeholder:text-muted-foreground/50`}
                      value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(digits(e.target.value, 8))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="sequence-number">
                    Sequence Number
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">SEQ</span>
                    <input
                      id="sequence-number"
                      placeholder="0000"
                      className={`${fieldInput} placeholder:text-muted-foreground/50`}
                      value={sequenceNumber}
                      onChange={(e) => setSequenceNumber(digits(e.target.value, 10))}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="sequence-date">
                    Sequence Date
                  </label>
                  <div className={fieldWrap}>
                    <span className="font-mono text-xs text-primary/70">Date</span>
                    <input
                      id="sequence-date"
                      inputMode="numeric"
                      className={fieldInput}
                      value={sequenceDate}
                      onChange={(e) => setSequenceDate(formatDdMmSlash(e.target.value))}
                    />
                    <span className="font-mono text-xs text-muted-foreground">dd/mm</span>
                    <span className="h-4 w-px bg-border" />
                    <Popover open={sequenceCalendarOpen} onOpenChange={setSequenceCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Pick sequence date from calendar"
                          className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-primary/10"
                        >
                          <CalendarIcon className="size-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={parseDdmm(sequenceDate)}
                          onSelect={(date) => {
                            if (!date) return;
                            setSequenceDate(format(date, "dd/MM"));
                            setSequenceCalendarOpen(false);
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                    <span className="font-mono text-xs text-muted-foreground">HHMM</span>
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    Date = Event Date · {eventDate}
                  </p>
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
                    <span className="font-mono text-xs text-muted-foreground">HHMM</span>
                    <span className="h-4 w-px bg-border" />
                    <span className="font-mono text-xs text-primary/70">Date</span>
                    <input
                      aria-label="Sign-in date"
                      inputMode="numeric"
                      className="w-20 shrink-0 bg-transparent font-mono text-sm text-foreground outline-none"
                      value={signInDate}
                      onChange={(e) => setSignInDate(formatDdMmSlash(e.target.value))}
                    />
                    <span className="font-mono text-xs text-muted-foreground">dd/mm</span>
                    <Popover open={signInCalendarOpen} onOpenChange={setSignInCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Pick sign-in date from calendar"
                          className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-primary/10"
                        >
                          <CalendarIcon className="size-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={parseDdmm(signInDate)}
                          onSelect={(date) => {
                            if (!date) return;
                            setSignInDate(format(date, "dd/MM"));
                            setSignInCalendarOpen(false);
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div>
                <span className={labelCls}>Back for Duty</span>
                <div className={fieldWrap}>
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
                  <span className="font-mono text-xs text-primary/70">Time</span>
                  <input
                    aria-label="Back for duty time"
                    inputMode="numeric"
                    className={fieldInput}
                    value={backForDutyTime}
                    onChange={(e) => setBackForDutyTime(digits(e.target.value, 4))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">HHMM</span>
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
                      {dutyTimeDisplay}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Fatigue HRS
                    </p>
                    <p className="font-mono text-lg font-semibold">{fatigueHrsDisplay}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Back for Duty
                    </p>
                    <p className="font-mono text-lg font-semibold">
                      {backForDutyDisplay}
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
                      <span
                        className="font-mono text-base font-bold tracking-wider uppercase"
                        style={{
                          color: "rgb(195, 0, 25)",
                          textShadow: "0 0 8px rgba(195, 0, 25, 0.7)",
                        }}
                      >
                        Can Rejoin Sequence?
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
                    {bidStatus === "RSV_FLYING" ? (
                      <div className="mt-2 flex w-full items-center gap-2 border-t border-border pt-2">
                        <span className="font-mono text-sm font-semibold tracking-wider uppercase">
                          RAP Started
                        </span>
                        <button
                          type="button"
                          onClick={() => setRapStarted(true)}
                          className={
                            rapStarted === true
                              ? "rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground ring-1 ring-primary/50"
                              : "rounded-md bg-secondary/40 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                          }
                        >
                          YES
                        </button>
                        <button
                          type="button"
                          onClick={() => setRapStarted(false)}
                          className={
                            rapStarted === false
                              ? "rounded-md bg-warning px-3 py-1 text-xs font-semibold text-warning-foreground ring-1 ring-warning/50"
                              : "rounded-md bg-secondary/40 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                          }
                        >
                          NO
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-2 flex w-full items-center gap-2 border-t border-border pt-2">
                      <span className="font-mono text-sm font-semibold tracking-wider uppercase">
                        Recovery Flying?
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecoveryFlying(true)}
                        className={
                          recoveryFlying === true
                            ? "rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground ring-1 ring-primary/50"
                            : "rounded-md bg-secondary/40 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-transform hover:-translate-y-px"
                        }
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecoveryFlying(false)}
                        className={
                          recoveryFlying === false
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

            {/* Entries and Steps — all entries and steps in one place. */}
            <div className="flex-1 rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Entries and Steps
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    disabled={plan.entries.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary/50 transition-transform hover:-translate-y-px disabled:opacity-40"
                  >
                    <span className="font-mono text-xs">{copied ? "COPIED" : "COPY"}</span>
                  </button>
                </div>
              </div>

              {plan.pending.map((msg) => (
                <div
                  key={msg}
                  className="mb-3 flex items-start gap-3 rounded-lg bg-warning/[0.08] px-3.5 py-3 ring-1 ring-warning/30"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-sm font-bold text-warning">
                    !
                  </span>
                  <p className="text-sm leading-relaxed text-warning/90">{msg}</p>
                </div>
              ))}

              <div className="divide-y divide-border rounded-xl bg-field/60 font-mono text-sm ring-1 ring-border">
                {plan.entries.length === 0 ? (
                  <p className="px-3.5 py-6 text-center text-xs text-muted-foreground">
                    No entries yet — resolve the inputs above.
                  </p>
                ) : (
                  plan.entries.map((e, i) => (
                    <div key={e.key} className="flex items-center gap-3 px-3.5 py-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded bg-primary/15 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                          {e.label}
                        </p>
                        <p className="whitespace-pre-wrap font-medium break-all">{e.code}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {plan.steps.length > 0 ? (
                <div className="mt-3 divide-y divide-border rounded-xl bg-field/60 text-sm ring-1 ring-border">
                  {plan.steps.map((s, idx) => (
                    <div key={s.n} className="flex items-start gap-3 px-3.5 py-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded bg-accent/15 font-mono text-xs font-semibold text-accent">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {stepTextWithLink(s.text)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {plan.notes.map((n) => (
                <p
                  key={n}
                  className="mt-3 rounded-lg bg-secondary/30 px-3.5 py-2.5 font-mono text-xs text-warning ring-1 ring-warning/30"
                >
                  {n}
                </p>
              ))}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Enter codes, dates and durations exactly as listed. Entries and steps re-compute on
                every field change.
              </p>
              {reminderVisible ? (
                <div className="mt-5 rounded-xl bg-warning/[0.08] px-4 py-3 ring-1 ring-warning/35">
                  <p className="font-mono text-xs font-semibold text-warning">
                    {schedulerName.trim() || user.name}: AFTER FATIGUE COMPLETED, NOTIFY PILOT — DETAILED VOICE MESSAGE OR POSITIVE CONTACT.
                  </p>
                </div>
              ) : null}
            </div>

          </section>
        </div>


        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="rounded-2xl bg-panel/40 p-5 ring-1 ring-border backdrop-blur-xl sm:p-6 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Saved Events · {user.name} · {saved.length}
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
        <div className="space-y-5 lg:col-span-4">
          <SuggestionBox author={user.name} />
          <AdminSuggestions />
          <AdminEvents />
        </div>
        </div>


        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="tracking-[0.2em] uppercase">Crew Scheduling</span>
          <span className="max-w-[60ch] text-balance">Unofficial employee-developed tool. Not authorized or endorsed by American Airlines. Use at your own risk.</span>
        </footer>
      </div>

    </div>

  );
}

