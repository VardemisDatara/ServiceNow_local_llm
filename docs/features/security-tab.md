# Security Tab

The **Security** tab provides a proactive, live view of your ServiceNow security incidents alongside an AI-powered analysis chat. Click **Security** in the top navigation bar to open it.

---

## Layout Overview

The Security tab uses a side-by-side split layout:

```
┌──────────────────────┬──────────────────────────────────────────┐
│                      │                                          │
│   Incident List      │   Security Incident Analysis             │
│   Panel              │   (AI Chat)                              │
│   (left, 320 px)     │   (right, fills remaining space)         │
│                      │                                          │
└──────────────────────┴──────────────────────────────────────────┘
                       ↑ draggable divider
```

The divider can be dragged to resize the panels (left panel minimum 220 px, maximum 500 px).

---

## Incident List Panel (Left)

The incident list loads automatically when the Security tab is opened. No query is required.

### What Each Column Shows

| Column | Description |
|--------|-------------|
| **Number** | ServiceNow incident number (e.g. `SIR0001234`) |
| **Short Description** | Brief summary of the incident |
| **Severity** | Colour-coded badge: Critical, High, Medium, Low |
| **State** | Current state chip: Open, Closed, etc. |
| **Last Updated** | Timestamp of the most recent update |

### Filter Bar

The filter bar sits at the top of the incident list:

- **Status toggle**: **Open** / **Closed** / **All** — default is Open. Click a toggle to change the filter; the list re-fetches immediately.
- **Severity dropdown**: **All** / **Critical** / **High** / **Medium** / **Low** — filters by severity. Combined with the status filter.

### Expanding an Incident

Click any incident row to expand it and see the full detail view:

- **Description** — full incident description
- **Assignment Group** — team responsible for the incident
- **Affected CIs** — configuration items affected
- **Comments / Work Notes** — activity log

Click the same row again to collapse it. Only one row can be expanded at a time.

### Loading More Incidents

The panel loads 50 incidents per page. If there are more, a **Load more** button appears at the bottom. Click it to append the next page to the list.

### Header Controls

The panel header contains:

| Control | Description |
|---------|-------------|
| **Last refreshed: HH:MM** | Timestamp of the most recent data fetch, always visible |
| **Refresh button** | Triggers an immediate reload and resets the auto-refresh timer |
| **Interval selector** | Switch between **5 min** / **10 min** / **15 min** auto-refresh intervals |

---

## Auto-Refresh

The incident list automatically refreshes at the configured interval (default: every 5 minutes). Refreshes happen silently in the background — they do not interrupt any expanded row or scroll position.

The "Last refreshed" timestamp in the header updates after each refresh so you always know how current the data is.

To change the interval:
1. Use the interval selector in the panel header (5 / 10 / 15 min).
2. The timer resets immediately; the next refresh fires at the new interval.

---

## Security Incident Analysis (Right Panel)

The right panel is an AI-powered chat specialised for security incident workflows. Use it to:

- **Investigate incidents**: ask the model to analyse a selected incident's timeline, affected CIs, and patterns
- **Run phishing analysis**: describe phishing indicators; the model correlates against recent incidents
- **Vulnerability assessment**: ask about CVEs; the model fetches ServiceNow vulnerability records and explains the risk
- **Compliance checks**: ask about policy compliance for a given incident category

The analysis chat uses the same MCP tool-calling mechanism as the main Chat tab — the model automatically fetches relevant ServiceNow data when needed.

---

## Error States

| State | What You See |
|-------|-------------|
| No active profile | "No active profile configured" with a link to Settings |
| Loading | "Initializing security workspace…" |
| ServiceNow unreachable | Error banner in the incident list with a **Retry** button |
| Empty filter result | "No incidents found" message with the current filter parameters |
