# Business flows

Each flow doc traces a multi-step business process end-to-end: which UI action / webhook starts it, every handler that runs, every table that gets touched, and what it chains into next. This is the "verb" layer — for the "noun" layer (tables) see [../tables/](../tables/), and for the "where" layer (files) see [../architecture/](../architecture/).

## Flow index

Ordered by complexity (highest first). Highest-complexity flow drives the rest of the pipeline.

| Flow | One-liner |
|---|---|
| [contract-and-payment.md](contract-and-payment.md) | The MAP1 master flow: PIP1 reconfirmation → PF decision → PCADMIN pricing → BoldSign agreement → CEO countersign → Stripe payment → confirmation/invoice/receipt → revenue share. Touches every integration. |
| [tax-planning.md](tax-planning.md) | The Tax Planning master flow (within Holistic Planning program): Ready for Tax 3 → ROI decision → BoldSign agreement → CEO countersign → Stripe retainer payment → confirmation/invoice/receipt. Parallel structure to MAP1 but operating on `client_tax_plans`. Phases 6+7 (revshare/refund/implementation auto-charge) not yet wired. |
| [boldsign-webhook.md](boldsign-webhook.md) | What happens when BoldSign tells us a document was signed |
| [stripe-webhook.md](stripe-webhook.md) | What happens when Stripe tells us a payment occurred (handles both MAP1 payments and GC credit purchases) |
| [ciq.md](ciq.md) | Client Intake Questionnaire — create, fill, complete, prioritize, snapshot |
| [specialist-onboarding.md](specialist-onboarding.md) | Multi-stage workflow for vetting a new specialist |
| [msm-tracking.md](msm-tracking.md) | Member-Servicing-Manager tracking — enrollments, training, clients, priorities |
| [coaching-renewals.md](coaching-renewals.md) | Coaching meeting log + renewal lifecycle |
| [gift-credits.md](gift-credits.md) | GC marketplace — buy credits via Stripe, redeem for services |
| [notifications.md](notifications.md) | How portal notifications get inserted and read |

## Doc conventions

Every flow doc follows the same structure:

1. **Trigger** — what fires this flow (UI action, webhook, server-side chain, scheduled, manual)
2. **Step-by-step** — handlers in execution order with `file:line` citations
3. **Tables touched** — reads vs writes
4. **Downstream chains** — what *this* flow fires next
5. **Failure modes / open questions** — uncertainties explicitly called out

## Open questions surfaced across all flows

These are the unresolved items that would need user/external confirmation:

1. **BoldSign webhook URL configuration** — both standalone and embedded handlers exist; only the standalone chains downstream. Live URL must be confirmed externally. Documented in [boldsign-webhook.md](boldsign-webhook.md).
2. **Stripe quarterly payment 2-4 invocation** — no observed code path creates these PaymentIntents. Documented in [stripe-webhook.md](stripe-webhook.md).
3. **Reminder cron jobs** — `c14_followup1_sent`, `c14_followup2_sent`, `c17_followup1_sent`, `c17_followup2_sent`, `pay1_followup1_sent`, `pay1_followup2_sent` columns exist on `pipeline_map1` but no code writes them. May be unimplemented or external. Documented in [contract-and-payment.md](contract-and-payment.md).
4. **GC purchase fulfillment** — confirmed: handled by the Stripe webhook handler at [admin-api:270-288](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) via `metadata.member_number` + `metadata.credits`. Documented in [gift-credits.md](gift-credits.md).
