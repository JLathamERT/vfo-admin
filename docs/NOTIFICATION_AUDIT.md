# VFO Notification Audit

> Generated 2026-07-02 from a full sweep of every `notifications`-table insert in `vfo-admin-api`.
> This list is now LIVE data: every row below is a `notification_rules` row, editable in
> **Admin Portal -> Automation -> Notification Editor** (recipients, days, on/off).
>
> **Recipient refresh 2026-07-27 (v664).** Tim Gacsy left the company; every notification hardcoded
> to him was rerouted (gotcha #291). The tax client-decision bells and the Tax 4 meeting nudge now
> resolve **assigned PF + allocated tax planner** (+ Tracy on the nudge, and as the universal
> fallback); the specialist tax-risk-notes prompts go to Tracy. Rows below reflect that.

## How to read this

- **FYI** — informational bell row with a green Done button; clicking the row or Done dismisses it.
- **Action required** — no Done button; the row only disappears when the underlying task is completed
  (e.g. the pricing form is submitted, the specialist is created, the notes are saved).
- **Reminder email** — not a bell row: an automated Gmail draft a daily sweep produces for the stalled
  party (client/advisor/accountant/specialist). Listed here because its TIMING (days) and on/off switch
  are editable in the Notification Editor; its wording lives in Email Templates.
- **Who gets it** — the system default. Dynamic recipients resolve per event: *Assigned PF* = the
  client's assigned PF login (falls back to Tracy for tax, or the shared admin bell elsewhere);
  *Allocated Tax Planner* = the plan's `tax_planner_id` planner, who receives a `/tax-planner/...`
  link of their own on shared bells (gotcha #292);
  *Onboarding Team Member* = the Stage-1 team member (falls back to the shared bell); *Assigned Admin* =
  the growth plan's assigned admin.
- **Editable days** — sweep ladders fire N days after the prior step; N is now editable per rule.
  The 24h Tax 4/5 auto-locks and the 14-day advisor/accountant auto-decline are business actions,
  not notifications, and are deliberately NOT editable here.

> **Additions 2026-07-28 (v667–v669).** Five rules were seeded to close the "stalled setup is completely
> silent" gap (gotchas #296 / #299 / #300): three under **VFO Specialist Revenue** and two under a
> **NEW area, Payment Continuation**. Both areas are listed below.

## Every notification in the system (128 rules, 11 areas)

### MAP 1 (14)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Client chose a service level** — Client clicked Yes on the /decide page and selected a membership level - the assigned PF must complete the pricing form. | **Action required** | Assigned PF | Client click on /decide page — instant |
| **Client requested extra meeting** — Client clicked Request Additional Meeting on the /decide page - the assigned PF must process the outcome. | **Action required** | Assigned PF | Client click on /decide page — instant |
| **Client signed the agreement** — The client signed the MAP 1 membership agreement; awaiting CEO countersignature. | FYI | Assigned PF | BoldSign client-signed webhook — instant |
| **Client made first payment** — The client made their first MAP 1 membership payment. | FYI | Assigned PF | Payment confirmation chain (payment 1 only) — instant |
| **Agreement email draft failed** — The Gmail draft of the agreement-signing email could not be created; needs manual attention. | **Action required** | All Admins (shared bell) | Gmail draft failure while sending agreement — instant |
| **Installment auto-charge failed** — A quarterly installment (P2-P4) could not be auto-charged; the client was emailed a fresh /pay link. | FYI | All Admins (shared bell) | Daily charge-scheduled sweep — instant |
| **Tracy: client paid, cleared to proceed** — A client's MAP 1 payment cleared (includes chosen priorities) - green light for Tracy to move forward. Fires once per payment P1-P4. | FYI | Tracy | Revshare chain after payment clears — instant |
| **Undecided decision reminder email** — Reminder email (fresh decision buttons) to a client who has not clicked any decision button. | Reminder email | The client (email) | Daily MAP 1 sweep — after **2 day(s)** (editable) |
| **Undecided decision stalled (PF bell)** — The client still has not responded to the MAP 1 decision email - asks the PF to reach out. | FYI | Assigned PF | Daily MAP 1 sweep — after **4 day(s)** (editable) |
| **Agreement signing reminder email** — Reminder email (fresh BoldSign link) to a client who has not signed the agreement. | Reminder email | The client (email) | Daily MAP 1 sweep — after **2 day(s)** (editable) |
| **Agreement signing stalled (PF bell)** — The client still has not signed the MAP 1 agreement - asks the PF to reach out. | FYI | Assigned PF | Daily MAP 1 sweep — after **4 day(s)** (editable) |
| **First payment reminder email** — Reminder email (/pay link) to a client who has not completed the first payment. | Reminder email | The client (email) | Daily MAP 1 sweep — after **2 day(s)** (editable) |
| **First payment stalled (PF bell)** — The client still has not paid the MAP 1 first payment - asks the PF to reach out. | FYI | Assigned PF | Daily MAP 1 sweep — after **4 day(s)** (editable) |
| **Check payment due reminder email** — Reminder email to check-paying quarterly clients whose next installment is due soon. The delay is a LOOK-AHEAD (days before the due date). | Reminder email | The client (email) | Daily check-reminder sweep — after **7 day(s)** (editable) |

### Tax (21)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Client chose Yes (Tax 3)** — Client clicked Yes on the /tax-decide page - pricing form needs to be completed to send the engagement agreement. | **Action required** | Assigned PF | Client click on /tax-decide — instant |
| **Client requested extra meeting** — Client clicked Request Extra Meeting on the /tax-decide page instead of Yes/No. | **Action required** | Assigned PF | Client click on /tax-decide — instant |
| **Deposit refund issued** — the deposit was refunded via Stripe after the admin picked **Refund** on the "Tax Plan Green/Red Light" step (inside Tax 1 - Diagnostic, `task_order=8`); the confirmation email drafted to the client carries the admin-typed reason. **The same handler also retires Tray's action-required `Tax Planner review complete for%` bell** — on a program-4 Stop the refund IS that bell's instruction (2026-08-11). | FYI | Assigned PF | Admin Send Refund button — instant |
| **Retainer paid** — Client's Tax Planning retainer payment cleared (card/ACH/check). The client confirmation email is drafted for ACH + check only; a card retainer is receipt-only (gotcha #287) — **the bell still fires on every method**, because it lives in the same handler and is a payment side effect, not part of the email. | FYI | Assigned PF | Stripe webhook chain — instant |
| **Retainer paid — schedule detailed tax plan meeting** (`TAX_retainer_paid_schedule_meeting`, added 2026-07-31 / v687) — the client committed to tax planning and the Detailed tax plan meeting now needs booking. Title names the client ("«Client» has decided to move forward with tax planning"); deduped on unread. **Same event as "Retainer paid" above but a DIFFERENT rule key on purpose** — one event, two audiences, two rules (gotcha #313). | FYI | Tray (`tvaldes@elitert.com`) | Stripe webhook chain — instant, card + ACH at checkout; check payments on clear |
| **Client clicked Proceed (implementation)** — Client clicked Proceed on the Tax 5 implementation email; off-session charge fired. | FYI | Assigned PF + Allocated Tax Planner (fallback Tracy) | Client click on Tax 5 email — instant |
| **Client clicked Decline (implementation)** — Client clicked Decline on the Tax 5 implementation email; engagement closes, no implementation charge. | FYI | Assigned PF + Allocated Tax Planner (fallback Tracy) | Client click on Tax 5 email — instant |
| **Client clicked Refund (Decision 1)** — Client clicked Refund on the Tax 4 Client Decision 1 email; auto-refund fired. | FYI | Assigned PF + Allocated Tax Planner (fallback Tracy) | Client click on Tax 4 email — instant |
| **Client clicked Proceed (Decision 1)** — Client clicked Proceed / Continue now on the Tax 4 Client Decision 1 email; retainer revshare fired. | FYI | Assigned PF + Allocated Tax Planner (fallback Tracy) | Client click on Tax 4 email — instant |
| **Implementation charge failed** — Off-session implementation charge declined or needs authentication; fresh /tax-pay link drafted to the client. | FYI | Jake (`TAX_impl_charge_failed`) | Implementation charge failure — instant |
| **Tracy: client paid, cleared to proceed** — Client's tax retainer or implementation payment cleared - green light for Tracy to move forward. Fires once per payment. | FYI | Tracy | Payment cleared (revshare chain) — instant |
| **Tax 4 Undecided reminder email** — Client has not clicked Proceed/Refund after the Tax 4 Undecided email - reminder email drafted to the client. | Reminder email | The client (email) | Daily tax sweep — after **2 day(s)** (editable) |
| **Tax 4 Undecided stalled (PF bell)** — Client still has not responded to the Tax 4 Undecided email - asks the PF to reach out. | FYI | Assigned PF | Daily tax sweep — after **4 day(s)** (editable) |
| **Tax 5 Undecided reminder email** — Client has not clicked Proceed/Decline after the Tax 5 Undecided email - reminder email drafted to the client. | Reminder email | The client (email) | Daily tax sweep — after **2 day(s)** (editable) |
| **Tax 5 Undecided stalled (PF bell)** — Client still has not responded to the Tax 5 Undecided email - asks the PF to reach out. | FYI | Assigned PF | Daily tax sweep — after **4 day(s)** (editable) |
| **Tax 3 decision reminder email** — Client has not clicked a /tax-decide button after the Tax 3 Undecided email - reminder email drafted to the client. | Reminder email | The client (email) | Daily tax sweep — after **2 day(s)** (editable) |
| **Tax 3 decision stalled (PF bell)** — Client still has not clicked a decision button after the Tax 3 Undecided email - asks the PF to reach out. | FYI | Assigned PF | Daily tax sweep — after **4 day(s)** (editable) |
| **Agreement signing reminder email** — Client has not signed the Tax Planning agreement - reminder email with a fresh sign link drafted to the client. | Reminder email | The client (email) | Daily tax sweep — after **2 day(s)** (editable) |
| **Agreement signing stalled (PF bell)** — Client still has not signed the agreement - asks the PF to reach out. | FYI | Assigned PF | Daily tax sweep — after **4 day(s)** (editable) |
| **Retainer payment reminder email** — Client has not paid the Tax Planning retainer - reminder email with a fresh /tax-pay link drafted to the client. | Reminder email | The client (email) | Daily tax sweep — after **2 day(s)** (editable) |
| **Retainer payment stalled (PF bell)** — Client still has not paid the retainer - asks the PF to reach out. | FYI | Assigned PF | Daily tax sweep — after **4 day(s)** (editable) |
| **Client decision 1 needed** — The Tax 4 meeting date has passed with no Client decision 1 recorded - persistent bell until the decision is recorded. | **Action required** | Assigned PF + Allocated Tax Planner + Tracy | Daily tax sweep (meeting date passed) — instant |

### Regular Priorities (MAP 4) (4)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **MAP 4 form submitted** — A client submitted the MAP 4 Meeting Follow-Up form. | FYI | Tracy + Assigned PF | Public /map4-form submit — instant |
| **MAP 4 follow-up email** — The MAP 4 follow-up email (form link) drafted to the client after the meeting. | Reminder email | The client (email) | Daily MAP 4 sweep (after meeting date) — after **2 day(s)** (editable) |
| **MAP 4 reminder email** — Reminder email to the client to complete the MAP 4 form. | Reminder email | The client (email) | Daily MAP 4 sweep (after follow-up) — after **2 day(s)** (editable) |
| **MAP 4 form stalled** — The client still has not submitted the MAP 4 form after the follow-up and reminder emails. | FYI | Tracy + Assigned PF | Daily MAP 4 sweep (after reminder) — after **2 day(s)** (editable) |

### Advisor Onboarding (11)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Plan-checkbox read failed** — The advisor signed but the plan-checkbox read from BoldSign failed, so the payment amount could not be computed; the chain stalls until fixed. | **Action required** | All Admins (shared bell) | BoldSign CEO-countersign handler — instant |
| **Advisor clicked Yes** — The advisor clicked Yes on the onboarding decision email; the agreement send chain ran. | FYI | Onboarding Team Member | Advisor click on decision email — instant |
| **Advisor clicked No** — The advisor clicked No on the onboarding decision email; the decline email chain ran. | FYI | Onboarding Team Member | Advisor click on decision email — instant |
| **Extra meeting requested** (`ADVISOR_extra_meeting_requested`) — The advisor clicked Request Additional Meeting; the admin must book/hold the meeting and record its outcome. | **Action required** | Onboarding Team Member | Advisor click on decision/reminder email — instant |
| **Ready to create advisor** — Payment succeeded and invoice/receipt drafted - the Create Advisor and Send Setup Link step is now available. | **Action required** | Onboarding Team Member | Invoice/receipt chain after payment — instant |
| **Decision reminder email** — Reminder email (Yes/No buttons) to the advisor who has not clicked a decision. | Reminder email | The advisor (email) | Daily advisor sweep — after **2 day(s)** (editable) |
| **Decision stalled (bell)** — The advisor still has not responded to the decision email. | FYI | Onboarding Team Member | Daily advisor sweep — after **4 day(s)** (editable) |
| **Signing reminder email** — Reminder email (fresh sign link) to the advisor who has not signed the agreement. | Reminder email | The advisor (email) | Daily advisor sweep — after **2 day(s)** (editable) |
| **Signing stalled (bell)** — The advisor still has not signed the onboarding agreement. | FYI | Onboarding Team Member | Daily advisor sweep — after **4 day(s)** (editable) |
| **Payment reminder email** — Reminder email (checkout button) to the advisor who has not paid the onboarding fee. | Reminder email | The advisor (email) | Daily advisor sweep — after **2 day(s)** (editable) |
| **Payment stalled (bell)** — The advisor still has not paid the onboarding fee. | FYI | Onboarding Team Member | Daily advisor sweep — after **4 day(s)** (editable) |

### Accountant Onboarding (11)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Plan-checkbox read failed** — The accountant signed but the plan-checkbox read from BoldSign failed, so the payment amount could not be computed; the chain stalls until fixed. | **Action required** | All Admins (shared bell) | BoldSign CEO-countersign handler — instant |
| **Accountant clicked Yes** — The accountant clicked Yes on the onboarding decision email; the agreement send chain ran. | FYI | Onboarding Team Member | Accountant click on decision email — instant |
| **Accountant clicked No** — The accountant clicked No on the onboarding decision email; the decline email chain ran. | FYI | Onboarding Team Member | Accountant click on decision email — instant |
| **Extra meeting requested** (`ACCOUNTANT_extra_meeting_requested`) — The accountant clicked Request Additional Meeting; the admin must book/hold the meeting and record its outcome. | **Action required** | Onboarding Team Member | Accountant click on decision/reminder email — instant |
| **Ready to create accountant** — Payment succeeded and invoice/receipt drafted - the Create Accountant and Send Setup Link step is now available. | **Action required** | Onboarding Team Member | Invoice/receipt chain after payment — instant |
| **Decision reminder email** — Reminder email (Yes/No buttons) to the accountant who has not clicked a decision. | Reminder email | The accountant (email) | Daily accountant sweep — after **2 day(s)** (editable) |
| **Decision stalled (bell)** — The accountant still has not responded to the decision email. | FYI | Onboarding Team Member | Daily accountant sweep — after **4 day(s)** (editable) |
| **Signing reminder email** — Reminder email (fresh sign link) to the accountant who has not signed the agreement. | Reminder email | The accountant (email) | Daily accountant sweep — after **2 day(s)** (editable) |
| **Signing stalled (bell)** — The accountant still has not signed the onboarding agreement. | FYI | Onboarding Team Member | Daily accountant sweep — after **4 day(s)** (editable) |
| **Payment reminder email** — Reminder email (checkout button) to the accountant who has not paid the onboarding fee. | Reminder email | The accountant (email) | Daily accountant sweep — after **2 day(s)** (editable) |
| **Payment stalled (bell)** — The accountant still has not paid the onboarding fee. | FYI | Onboarding Team Member | Daily accountant sweep — after **4 day(s)** (editable) |

### Specialist Onboarding (34)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Stage 4: add general notes (Tracy)** — A specialist reached final executive approval (Stage 4) - Tracy must add her general notes before the executives vote. | **Action required** | Tracy | Stage 3 completes (all three items done) — instant |
| **Stage 4: add tax risk notes** — A tax specialist reached final executive approval (Stage 4) - the tax risk notes must be added before the executives vote. | **Action required** | Tracy (was Tim until 2026-07-27) | Stage 3 completes (tax specialists only) — instant |
| **SIF form submitted** — A specialist submitted their Specialist Information Form. | FYI | Tracy | Public SIF form submit — instant |
| **Background check paid** — A specialist's background-check payment cleared and the receipt was sent. | FYI | Tracy | Stripe webhook chain (bg receipt) — instant |
| **Due Diligence Checklist submitted** — A specialist marked their Due Diligence Checklist ready for review. | FYI | Tracy | Public DDC form submit — instant |
| **DDC help requested** — A specialist asked for help completing the Due Diligence Checklist; clears when Help Received is clicked. | **Action required** | Tracy | Specialist click in Step 3 email — instant |
| **Further questions (background check)** — A specialist chose I Have Further Questions instead of picking Core/Max; clears when Tracy proceeds or stops. | **Action required** | Tracy | Specialist click in Step 3 email — instant |
| **Submit revenue share proposal** — All Stage 2 detail-meeting items are covered but no revenue share proposal exists yet; clears when it is saved. | **Action required** | Tracy | Stage 2 progress email with all items complete — instant |
| **Finalize revenue share proposal** — A specialist has further questions on the final revenue share proposal; clears when Tracy keeps or edits it. | **Action required** | Tracy | Specialist click on final rev-share page — instant |
| **Revenue share proposal approved** — The specialist confirmed they are happy with the final revenue share proposal. | FYI | Tracy | Specialist click on final rev-share page — instant |
| **Round 1 voting completed** — Both executives cast their round 1 (initial approval) vote. | FYI | Anton + Paul + Tracy | Second exec casts round 1 vote — instant |
| **Second decision needed** — Round 1 raised Further Questions - both executives must cast a round 2 Approved/Denied decision. | **Action required** | Anton + Paul | Round 1 completes with Further Questions — instant |
| **Round 2 completed (approved)** — Both executives approved in round 2; the stage's approval outcome is applied. | FYI | Anton + Paul + Tracy | Both execs vote Approved in round 2 — instant |
| **Round 2 completed (denied)** — Both executives denied in round 2; the onboarding stops and the decline email auto-drafts. | FYI | Anton + Paul + Tracy | Both execs vote Denied in round 2 — instant |
| **Re-vote needed** — The executives' round 2 decisions did not match; both must re-vote. | **Action required** | Anton + Paul | Round 2 split decision — instant |
| **Send VFO Skool invite** — First license payment received (Stage 4 complete) - time to send the VFO Skool invite; clears when sent. | **Action required** | Tracy | First license invoice paid — instant |
| **Create the VFO Specialist and send login** — Specialist reached Stage 5 - add them to the Showroom and send their portal login; clears when created. | **Action required** | Tracy | First license invoice paid — instant |
| **Add specialist headshot** — The Showroom profile was auto-created; add the specialist's headshot. Clears when its checkbox is ticked. | **Action required** | Tracy | Create Specialist button — instant |
| **SIF stall reminder email** — Reminder email to the specialist when the SIF form is unsubmitted. | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **SIF stalled (Tracy bell)** — The SIF form is still unsubmitted after the reminder window. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **Exec vote stall reminder email** — Reminder email to whichever executive(s) have not voted in an open voting round. | Reminder email | Anton + Paul | Daily specialist sweep — after **2 day(s)** (editable) |
| **Exec vote stalled (Tracy bell)** — The executives still have not finished a voting round. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **Background-check choice reminder email** — Reminder email when no Core/Max selection has been made after the Step 3 email. | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **Background-check choice stalled (Tracy bell)** — The specialist still has not chosen a background check. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **DDC stall reminder email** — Reminder email when the Due Diligence Checklist is unsubmitted (paused while a help request is open). | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **DDC stalled (Tracy bell)** — The Due Diligence Checklist is still unsubmitted after the reminder window. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **Final rev-share stall reminder email** — Reminder email when the final revenue share proposal is unanswered. | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **Final rev-share stalled (Tracy bell)** — Still no response to the final revenue share proposal after the reminder window. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **Agreement signature reminder email** — Reminder email (fresh BoldSign link) when the Specialist Agreement is unsigned. | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **Agreement signature stalled (Tracy bell)** — The Specialist Agreement is still unsigned after the reminder window. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **License payment reminder email** — Reminder email when the monthly license payment has not been set up. | Reminder email | The specialist (email) | Daily specialist sweep — after **2 day(s)** (editable) |
| **License payment stalled (Tracy bell)** — The monthly license payment still has not been completed after the reminder window. | FYI | Tracy | Daily specialist sweep — after **4 day(s)** (editable) |
| **Background-check payment failed (Tracy)** — A specialist's background-check payment failed; they may need a fresh payment link. | FYI | Tracy | Stripe webhook: payment_intent.payment_failed — instant |
| **License payment failed (Tracy)** — A specialist's monthly license payment failed; their card/bank may need updating. | FYI | Tracy | Stripe webhook: invoice.payment_failed — instant |

### Partnership Fast Track (8)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Discovery form submitted** — An accountant prospect submitted the PFT discovery form. | FYI | Assigned PF | Public /pft-discovery form submit — instant |
| **Discovery form reminder email** — Reminder email to the accountant prospect to complete the discovery form. | Reminder email | The accountant (email) | Daily PFT sweep — after **2 day(s)** (editable) |
| **Discovery form stalled** — The discovery form is still incomplete after the reminder window - asks the PF to follow up. | FYI | Assigned PF | Daily PFT sweep — after **4 day(s)** (editable) |
| **Fast Track decision reminder email** — Reminder email re-sending the two VFO Fast Track decision buttons to the accountant prospect. | Reminder email | The accountant (email) | Daily PFT sweep — after **2 day(s)** (editable) |
| **Fast Track decision stalled** — The accountant has not clicked a VFO Fast Track decision button - asks the PF to follow up. | FYI | Assigned PF | Daily PFT sweep — after **4 day(s)** (editable) |
| **VFO Associate confirmed** — An admin confirmed the prospect as a VFO Associate and handed off to Accountant Onboarding. | FYI | Assigned PF | Admin PFT decision step — instant |
| **Fast Track onboarding confirmed** — The accountant clicked Confirm Onboarding in the Fast Track email. | FYI | Assigned PF | Client click on Fast Track email — instant |
| **Fast Track: another meeting requested** — The accountant clicked I'd Like Another Meeting in the Fast Track email. | FYI | Assigned PF | Client click on Fast Track email — instant |

### Growth Plan (2)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Member updated progress** — A member updated the status of a Growth Plan priority (one bell per priority changed). | FYI | Assigned Admin | Member saves accountability progress — instant |
| **Overdue priority** — A Growth Plan priority passed its due date with no progress. | FYI | Assigned Admin | Daily growth sweep — instant |

### VFO Specialist Revenue (6)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Payment reminder email** — Reminder email to the specialist to pay their VFO Specialist Revenue request. | Reminder email | The specialist (email) | Nightly payout sweep — after **2 day(s)** (editable) |
| **Specialist still has not paid** — A specialist's revenue payment is still unpaid after the reminder window - asks Tracy to chase. | FYI | Tracy | Nightly payout sweep — after **4 day(s)** (editable) |
| **Revenue transfer failed (Jake)** — A revenue-share transfer to a member failed; the nightly sweep will retry; auto-clears on success. | **Action required** | Jake | Payout engine transfer failure — instant |
| **Checkout abandoned** (`SPECREV_checkout_abandoned_bell`, 2026-07-28) — the specialist opened the hosted payment page but never completed it, so the Stripe session expired; nothing was charged and the link they hold still works. Covers BOTH the one-off request and the recurring monthly setup. | FYI | Tracy + Jake | `checkout.session.expired` webhook — instant (gotcha #299) |
| **Recurring setup reminder email** (`SPECREV_recurring_setup_reminder_email`, 2026-07-28) — nudges a specialist who was sent the recurring ACH setup link but never finished it; carries the amount, charge day and a fresh Complete Setup button. | Reminder email | The specialist (email) | Nightly payout sweep, Pass 3 — after **2 day(s)** (editable) |
| **Recurring setup still not completed** (`SPECREV_recurring_setup_tracy_bell`, 2026-07-28) — the recurring plan is still `setup_pending` after the reminder window; asks Tracy to chase. | FYI | Tracy | Nightly payout sweep, Pass 3 — after **4 day(s)** (editable) |

### Payment Continuation (2) *(new area, 2026-07-28)*

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **Setup-link reminder email** (`MIGRATION_setup_link_reminder_email`) — nudges a migrated client who was emailed the `/connect-card` link but never saved a card or bank; includes the same `[PAYMENT_SCHEDULE]` block as the original setup email — **a "Your upcoming payments:" table for MAP 1, but since v715 (2026-08-10) NO figure at all for TAX**, just the fixed "set up proactively … to collect any future payments" sentence (#352). **If the link has EXPIRED the sweep mints a fresh 7-day one and emails that instead** (capped at 3 automatic re-sends per row). | Reminder email | The client (email) | Nightly check-reminder sweep — after **2 day(s)** (editable) — gotcha #300 |
| **Client hasn't set up their payment method** (`MIGRATION_setup_link_stall_bell`) — their remaining scheduled payments cannot run. Wording is four-way truthful: reach out / a fresh link was automatically emailed / re-send manually / automatic re-sends exhausted. | FYI | Tracy + Jake | Nightly check-reminder sweep — after **4 day(s)** (editable) |

### Payment Failure Alerts (16)

| Notification | Type | Who gets it (default) | When it fires |
|---|---|---|---|
| **MAP 1 installment charge failed (Jake)** — Money-movement alert for a failed MAP 1 quarterly auto-charge. | FYI | Jake | Daily charge-scheduled sweep — instant |
| **MAP 1 revshare transfer failed (Jake)** — The Stripe Connect member revenue-share transfer failed; the daily sweep retries; auto-clears on success. | **Action required** | Jake | Revshare transfer failure — instant |
| **PIP revshare transfer failed (Jake)** — The revenue-share transfer for a PIP purchase failed; PIP has no retry sweep - needs manual re-fire. | **Action required** | Jake | PIP purchase revshare failure — instant |
| **Tax implementation charge failed (Jake)** — Money-movement alert when the tax implementation off-session charge fails. | FYI | Jake | Implementation charge failure — instant |
| **Tax revshare transfer failed (Jake)** — Stripe Connect member revenue-share transfer failed for a tax payment; daily sweep retries; auto-clears on success. | **Action required** | Jake | Revshare transfer failure — instant |
| **Strategic partner share failed (Jake)** — The 10 percent strategic partner share could not be transferred (missing Connect account or Stripe error); daily sweep retries; auto-clears on success. | **Action required** | Jake | Strategic partner transfer failure — instant |
| **Specialist background-check payment failed (Jake)** — Stripe reported a failed background-check payment (payment_intent.payment_failed) for a specialist in onboarding. | FYI | Jake | Stripe webhook: payment_intent.payment_failed — instant |
| **ACH first payment bounced (Jake)** — An ACH first payment bounced after checkout completed (any pipeline; also fires for an unmapped Stripe customer). | FYI | Jake | Stripe webhook: checkout.session.async_payment_failed — instant |
| **First payment declined (Jake)** — A first payment was declined (non-installment, non-specialist); the pipeline row is marked failed. | FYI | Jake | Stripe webhook: payment_intent.payment_failed — instant |
| **Specialist license payment failed (Jake)** — The specialist $99/mo license subscription invoice failed to collect. | **Action required** | Jake | Stripe webhook: invoice.payment_failed — instant |
| **Specialist license past due / canceled (Jake)** — The specialist license subscription went past due or was canceled (consider revoking access); auto-clears on recovery. | **Action required** | Jake | Stripe webhook: customer.subscription.updated/deleted — instant |
| **Chargeback opened (Jake)** — A customer opened a Stripe dispute/chargeback; respond in the Stripe Dashboard before the evidence deadline. | **Action required** | Jake | Stripe webhook: charge.dispute.created — instant |
| **Chargeback closed (Jake)** — A dispute was resolved (won or lost); the opened-alert clears automatically. | FYI | Jake | Stripe webhook: charge.dispute.closed — instant |
| **Refund issued (Jake)** — A refund was issued (including ones made directly in the Stripe Dashboard). | FYI | Jake | Stripe webhook: charge.refunded — instant |
| **Refund failed (Jake)** — A refund FAILED — the money was not returned to the customer. | FYI | Jake | Stripe webhook: refund.failed — instant |
| **Rev-share transfer reversed (Jake)** — A revenue-share Stripe Connect transfer was reversed/clawed back. | FYI | Jake | Stripe webhook: transfer.reversed — instant |

> **Update 2026-07-03 — Phases A + B of the gap list are BUILT** (8 new rules, so the editor now
> holds 130): gap #2 (tax-return uploads -> `UPLOAD_tax_return_uploaded`, new "Uploads" area,
> default Tray vD + Tim — Tim removed 2026-07-21, Tracy added), #5 (BoldSign Declined/Expired/Revoked -> `<AREA>_agreement_declined`
> action-required bells, new `automation_AGREEMENT_declined` handler chained from BOTH BoldSign
> webhook handlers — 5th approved extension of the standalone function), and #6 (check never
> cleared -> `MAP1/TAX_check_uncleared_bell`, 14-day editable tier in the check-reminder sweep,
> incl. overdue quarterly P2-P4 checks). The stall-bell "4 days" wording now reflects the
> configured delay. Gap #1 (login-setup completions) was built then REMOVED same-day at Jake's
> direction — nobody needs a bell for someone setting a passcode; treat #1 as closed-won't-do.
> Gaps #3, #4, #7-#10 (Phases C + D) remain open below.
>
> **Update 2026-07-28 — a gap the original list missed is now closed: "the setup was never completed".**
> Neither a SPECREV recurring plan stuck in `setup_pending` nor a migrated client sitting on an unused
> (or expired) `/connect-card` link produced any signal at all — both failed open and stayed invisible
> for two weeks. Five rules now cover it (three under VFO Specialist Revenue, two under the new
> Payment Continuation area), plus abandonment detection off `checkout.session.expired`. Gap **#3**
> (payment method updated) is still open — that is the SUCCESS side of the same flow; what shipped is
> the STALL side. Gotchas #296 / #298 / #299 / #300.

## Gap analysis — places that arguably SHOULD notify but currently do not

Verified against the code (several "gaps" a first pass suggested turned out to already be covered —
disputes, refunds, ACH bounces, subscription lapses and transfer reversals all already alert Jake's
bell via the 2026-06-15 failure-alert work). What genuinely has no notification today:

| # | Event | What happens today | Suggested notification |
|---|---|---|---|
| 1 | **Login setup completed** (client `/client-setup`, member `/set-password`, specialist login-setup) | Timestamp written, login row created — silent | FYI to the assigned PF (clients) / Tracy (specialists) / shared bell (members): "X can now sign in" — confirms the invite landed and closes the loop |
| 2 | **Client uploads a tax return** (public `/tax-upload` token page or client Vault -> Sensitive) | **RESOLVED — no longer silent.** `actions/vault/upload-notify.ts` stamps `tax_returns_received_at` on every waiting plan and raises the **action-required** `TAX_returns_allocate_team_member` ("Allocate a team member for X") to Tracy + Tray, cleared only when a planner is allocated; an upload with no requested plan still falls through to the generic `UPLOAD_tax_return_uploaded` FYI | — |
| 3 | **Payment method updated** (Phase D `/connect-card` setup completes via Stripe webhook) | New default card/bank saved — silent | FYI to Jake: "X updated their payment method" — audit trail + confirms a failed-installment recovery is ready to retry |
| 4 | **Member/specialist Stripe Connect onboarding completes** (payout account becomes active) | Nothing observes this; the next transfer just succeeds | FYI to Jake/Tracy: "X's payout account is active" — today you only find out when a transfer stops failing |
| 5 | **BoldSign document Declined or Expired** | Event not handled at all — the pipeline just stalls until the signing-stall sweep notices | Action-required to the assigned PF / team member: "X declined the agreement" — a decline is a decision, not a stall, and deserves an immediate bell (the 48h/96h ladder is the wrong tool) |
| 6 | **Check payment claimed but never clears** (MAP 1 / tax "paid by check" with no `checkcleared` after N days) | No sweep watches this — silent forever | Bell to Tracy + Jake after e.g. 14 days: "X's check has not been marked cleared" |
| 7 | **Advisor/accountant 6-month renewal approaching** (`renewal_date` on advisor/accountant onboarding) | Column is written on payment, nothing reads it | Reminder ladder: FYI to team member 14 days before renewal; escalate if lapsed |
| 8 | **14-day auto-decline fired** (advisor/accountant implicit No) | Decline email drafts; no bell | FYI to the team member: "X was auto-declined after 14 days" — otherwise a prospect silently disappears from the pipeline |
| 9 | **New member/advisor/accountant goes live** (create-member runs) | The action-required "Ready to create" bell clears — nothing confirms | Optional FYI to the team member: "X is live, setup link sent" |
| 10 | **PIP payment chain stalls** (PIP has no cron and no reminder ladder) | Failed/stalled PIP chains need manual re-fire; only the Jake transfer-failure alert exists | Low priority (purchases are admin-driven), but a "PIP purchase pending >2 days" bell would close the loop |

None of these are built yet — each is a small, independent add now that the rule layer exists (a new
rule row + one `notifyByRule` call at the right spot; #5-#7 also need a small webhook branch or sweep
query). Priority suggestion: #5 and #6 first (money/decision events that currently vanish), then #2.

## Architecture (for future sessions)

- `utils/notify.ts` — `notifyByRule(supabase, key, {...})` is the ONLY way notifications are inserted.
  A rule row can override recipients (`recipients` jsonb; dynamic tokens `ASSIGNED_PF` / `TEAM_MEMBER` /
  `ASSIGNED_ADMIN` resolve per event), disable the notification (`enabled=false`), and — for sweep
  tiers — change the days (`delay_days`). `recipients=null` = code default, so an unedited system
  behaves exactly as before this refactor.
- Sweeps read `getRuleConfig(supabase, keys)` once per run; a disabled tier is skipped BEFORE its
  idempotency guard is stamped, so re-enabling a tier later still fires for rows that stalled while off.
- `notification_rules` table: deny-all RLS; served only through `notification_rules_load` /
  `notification_rules_save` (both gated behind the Automation tab grant, gotcha #167).
- Known cosmetic quirk: some sweep bell MESSAGES hardcode "4 days" in their body text even when the
  configured delay differs (the timing is honored; only the wording is stale).
- Jake's failure-alert auto-clears (`clearJakeFailure`) now match on title for ANY recipient, so
  re-routing a failure alert in the editor does not break its auto-clear.
