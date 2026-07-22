# CRM Development Roadmap

## Phase 1: Core Data & Creation

**Branch Name:** `feat/budget-client-creation`

- [x] UI/Logic to add a client directly from the budget creation screen if they don't exist.
- [x] Add "TBD" (To Be Determined) flag for event dates.
- [x] Add "Airbnb" source flag to budgets (forces system to suppress client-facing emails).
- [x] Add financial tracking fields to budget model: Down Payment amount, _Fianza_ (Security Deposit) amount/required flag.

## Phase 2: The Client Portal & Compliance

**Branch Name:** `feat/client-portal-tnc`

- [ ] Generate secure, unique UUID links for budget viewing.
- [ ] Build the web view/screen for the client portal.
- [ ] Implement Terms & Conditions UI.
- [ ] Add scroll-tracking logic: Client must scroll to the absolute bottom of the T&C before the "Accept" button becomes clickable.

## Phase 3: Initial Invoicing & Financials

**Branch Name:** `feat/invoicing-flow`

- [ ] Webhook/Listener for "Budget Accepted" status.
- [ ] Auto-generate Invoice #1 (First half of payment).
- [ ] Ensure logic skips generation/sending if the event source is marked as "Airbnb".

## Phase 4: Automations & Timers (Cron Jobs / Background Tasks)

**Branch Name:** `feat/event-automations`

- [ ] **2-Month Timer:** Send Invoice #2 (Remaining balance) with a 30-day payment limit.
- [ ] **25-Day Warning:** Check payment status; if unpaid, send an urgent reminder that the event block is at risk.
- [ ] **Fianza Reminder:** Send automated notice for the security deposit if the budget requires it.
- [ ] **TBD Workshop Ping:** For events with rough months but no date, send a reminder 2 months prior asking them to lock in a specific weekend.
- [ ] **Post-Event:** Send the satisfaction survey link 1-2 days after the event date has passed.
