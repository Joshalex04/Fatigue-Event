# Scenario Test Run + PDF Report

Run the 10 scenarios from your file through the live app, capture a screenshot of each result, and deliver one PDF containing the screenshots plus a written report of the calculation logic and any errors found.

## What gets tested

| # | Bid Status | Base | Rejoin | Recovery / RAP |
|---|---|---|---|---|
| 1A | Line Holder | LGA | No | Recovery No |
| 1B | Line Holder | LAX | Yes | Recovery No |
| 2A | Reserve OG/PR | MIA | Yes | Recovery No |
| 2B | Reserve OG/PR | CLT | No | Recovery No |
| 2C | Reserve OG/PR | DCA | Yes | Recovery Yes |
| 2D | Reserve OG/PR | DFW | No | Recovery Yes |
| 3A | Reserve Flying | DFW | No | RAP started Yes |
| 3B | Reserve Flying | DFW | No | RAP started No |
| 3C | Reserve Flying | DFW | Yes | RAP started No |
| 3D | Reserve Flying | DFW | Yes | RAP started Yes |

Common inputs: Event date 04/09, sign-in 2345 (03/09, since the 0131 call is the next day), fatigue call 0131, back for duty 05/09 1000, FEM completed Yes.

Note: your file lists four scenarios all labeled "3B"; I will label them 3A–3D as above. Scenarios 3B–3D omit an event date, so I use 04sep26 like the others.

## How it runs

A browser automation script signs into the app, fills the inputs for each scenario, answers the Yes/No questions, and screenshots the Results panel plus the Entries and Steps panel. Each scenario is a fresh run so no state leaks between them.

## The PDF

Delivered as a document you can download from chat, containing:

1. Cover + input summary table.
2. One page per scenario: input recap and screenshots of the app output (Duty Time, Fatigue HRS, Pay, Event #, status, entries and steps).
3. Logic report: how Duty Time, Fatigue HRS, TR1, FDT/TDT and each scenario's entry/step branch are derived, written out in plain language so you can check it against the official procedure.
4. Errors/observations: anything that looks wrong, inconsistent, or fails to render, listed per scenario. Nothing gets fixed in this pass — you review first, then tell me what to correct.

## Technical notes

- Playwright drives `http://localhost:8080`; screenshots saved under `/tmp/browser/`.
- PDF built with a Python script; no app source files are changed.
- Expected duty for these inputs: sign-in 2345 (03SEP) to fatigue 0131 (04SEP) = 1:46; fatigue hrs 0131 to 1000/05 = 32:29. The report will flag any mismatch with what the app displays.
