# Fatigue Event — formats, duty time, sign-in date, notes

## How Duty Time is calculated today

Right now Duty Time uses only the two clock times, with no date:

```text
Duty = Time of Fatigue - Sign In Time
if Time of Fatigue is earlier on the clock than Sign In  ->  "NO DUTY"
```

Example: Sign In 2215, Fatigue 2330 -> 1:15. Sign In 0100, Fatigue 0200 -> 1:00.
Sign In 0200, Fatigue 0100 -> NO DUTY (no date to prove it was the next day).

That is already "Fatigue Call - Sign In", so the fix is about correctness of the
display and rounding rather than the formula. Confirmed behavior stays:
fatigue before sign-in shows NO DUTY.

## Changes

1. **Date formats DDMMMYY** — FDT (event date) and TDT (back-for-duty date) in every
   entry template change from `01SEP` to `01SEP26`. The year comes from the picked
   calendar date. Results panel keeps its short display unless you want it changed too.

2. **TR1 correction** — TR1 becomes `Sign In + Duty Time + 1 minute`
   (Sign In 2345 + 1:45 duty = 0130, +1 min = **0131**), rolling past midnight.
   Today it is Sign In + 1 minute, which is wrong.

3. **Sign-in date picker** — add a calendar picker next to Sign In time, defaulting to
   today. This gives an exact sign-in date so duty and back-for-duty spans across
   midnight are computed from real dates instead of guessed clock order.

4. **Reserve note** — when Bid Status is Reserve and the pilot is flying OG/PR, the
   Entries and Steps panel shows the note:
   "Reserve on OG/PR — recovery flying may only be assigned on RSV days."

5. **RAP message shows the command** — the Assign RAP note displays the entry command
   (`HYR/EMP#/FDT//RAP TIME`) instead of the filled value.

6. **Duty Time display** — keep `Fatigue Call - Sign In`, with NO DUTY when the fatigue
   call precedes sign-in; the sign-in date picker makes the cross-midnight case exact.

7. **Notification alert** — text becomes
   "AFTER FATIGUE COMPLETED, NOTIFY PILOT — DETAILED VOICE MESSAGE OR POSITIVE CONTACT."
   and it moves from the floating position to directly under the Entries and Steps box.

## Technical notes

- `src/lib/fatigue.ts`: `ddmmToDdMmm` gains a year argument (`ddmmToDdMmmYy`), template
  fill uses it for FDT/TDT; TR1 helper switches to fatigue-time+1 min derived from
  sign-in plus duty; sign-in date threads through `PlanInput`.
- `src/lib/fatigue-rules.ts`: `ASSIGN_RAP_NOTE` renders the command template; a new note
  row covers the Reserve OG/PR recovery-flying restriction.
- `src/routes/index.tsx`: sign-in date Popover + Calendar (same pattern as Event Date),
  saved-event record gains `signInDate`, and the notify alert is relocated below the
  Entries and Steps card.
