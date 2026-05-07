# Tables

51 public-schema tables in Supabase project `ejpsprsmhpufwogbmxjv` (VFO Showroom). All tables documented in this directory; this file is the index by group.

Read-only schema mapping — column lists, types, defaults, FKs, and which actions/files touch each table. No commentary about whether the design is "good," only about what exists.

## Index

| Doc | Tables | One-liner |
|---|---|---|
| [auth.md](auth.md) | `admin_sessions`, `allowed_admins`, `member_logins` | Session tokens + login credentials for admin and member portals |
| [members.md](members.md) | `members`, `member_plugin_settings`, `member_type_history`, `member_exclusions` | The advisor/accountant member roster + per-member website widget config |
| [clients.md](clients.md) | `clients`, `client_contacts`, `client_notes`, `client_enrollments`, `client_progress`, `client_priority_tracks`, `priority_progress` | The advisor's clients (downstream of members) + program/priority progress |
| [ciq.md](ciq.md) | `client_ciqs`, `ciq_answers`, `ciq_priorities`, `ciq_priority_snapshots`, `ciq_assignments` | Client Intake Questionnaire data + ranked priority decisions + snapshots |
| [tax.md](tax.md) | `client_tax_plans`, `client_tax_progress`, `client_tax_specialists` | Tax engagement plan + per-specialist progress |
| [programs.md](programs.md) | `programs`, `program_client_phases`, `program_client_tasks`, `program_training_phases`, `program_training_tasks`, `member_program_enabled`, `member_program_notes`, `member_enrollments`, `member_training_progress`, `member_meetings` | Program template (phases/tasks) + per-enrollment progress |
| [specialists.md](specialists.md) | `experts`, `vfo_ecosystem_assignments`, `specialist_onboarding`, `specialist_onboarding_meetings`, `specialist_onboarding_progress`, `specialist_onboarding_votes` | Specialist roster, ecosystem tags, onboarding workflow |
| [coaching.md](coaching.md) | `coaching_meetings`, `coaching_renewals` | Member-coaching meetings and renewal log |
| [marketplace-gc.md](marketplace-gc.md) | `gc_balances`, `gc_redemptions`, `gc_services`, `gc_transactions` | "Gift credit" marketplace — credits balance, services catalog, ledger |
| [pipeline.md](pipeline.md) | `pipelines`, `pipeline_map1`, `pipeline_sandbox_config` | The automation pipeline registry + the **central MAP1 row** (`pipeline_map1`) driving the contract/payment chain |
| [documents.md](documents.md) | `agreement_templates`, `email_templates`, `document_numbers` | BoldSign agreement templates, automation email copy, sequential invoice/receipt numbers |
| [notifications.md](notifications.md) | `notifications` | In-portal notification feed |

## Conventions used in column tables

- `pk` — primary key
- `fk → table.col` — foreign key (delete rule shown when not the default)
- `not null` — explicit `NOT NULL`; columns marked nullable have no `not null` annotation
- `default ...` — column default
- "Status field" — value drives state-machine transitions in the application
- "Automation field" — read or written by an `automation_*` action

## CHECK constraints (whole DB)

Only two non-null CHECK constraints exist (verified `pg_catalog`):

- `ciq_priorities.decision IN ('drop', 'park', 'prioritize')`
- `client_ciqs.status IN ('draft', 'completed')`

Every other status/decision column is **convention-only** — values like `'Yes'/'No'`, `'pending'/'live'/'paid'`, etc. are not constrained at the DB level; the admin-api enforces them.

## FK delete-rule summary

- Most FKs are `ON DELETE CASCADE` from a parent (client/member/onboarding/ciq/enrollment) — deleting a parent removes all dependent rows.
- `clients.enrollment_id → member_enrollments.id` is `SET NULL`.
- `client_tax_progress.tax_specialist_id` is `SET NULL`.
- `members.connected_member_number → members.member_number` is `SET NULL`.
- `client_progress.task_id`, `client_tax_progress.task_id`, `priority_progress.task_id`, `member_training_progress.task_id`, `program_*_tasks.phase_id`, `program_*_phases.program_id`, `member_enrollments.program_id`, `member_program_enabled.program_id`, `gc_redemptions.service_id` are all `NO ACTION` (deleting a parent task/phase/program/service errors).
- `pipeline_map1.client_id → clients.id` is `NO ACTION` — deleting a client will fail if a pipeline row exists, or orphan it. **Worth verifying behavior in practice.**
- `notifications.client_id → clients.id` is `NO ACTION`.
