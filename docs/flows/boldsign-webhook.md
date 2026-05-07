# BoldSign webhook flow

What happens when BoldSign tells the system that a document was signed or completed.

## Trigger

BoldSign POSTs JSON with `body.event.eventType` and `body.context.documentId` (or `body.data.documentId`) when:
- A signer signs (`Signed`)
- The final required signer signs and the document is fully executed (`Completed`)

The BoldSign webhook URL is configured **outside this codebase** in the BoldSign account settings.

## Two possible handlers (only ONE should be the live target)

| Handler | URL | Source | Chains downstream? |
|---|---|---|---|
| **Standalone function** | `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/boldsign-webhook` | [`C:\vfo-edge-functions\supabase\functions\boldsign-webhook\index.ts`](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts) | **Yes** |
| **Embedded in admin-api** | `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api` (gated by `body.event?.eventType` shape) | [`vfo-admin-api/index.ts:544-583`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | **No** |

Both handlers do the same database writes. Only the standalone version chains into the rest of the contract flow. **Confirm the live URL with the BoldSign account owner.**

## Standalone handler step-by-step

[boldsign-webhook/index.ts](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts):

1. Returns `200 OK` for any non-POST (preflight friendly).
2. Parses JSON body. On parse failure, returns `200 OK` (silent).
3. Extracts `eventType` and `documentId`. If either missing, returns `200 OK`.
4. Looks up `pipeline_map1` by `boldsign_doc_id`. If not found, returns `200 OK`.

### `eventType === "Completed"`

[Lines 40-58](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts):

1. UPDATEs `pipeline_map1` SET `c17_client_signed='Yes'`, `c18_ceo_signed='Yes'`, `updated_at=now()`.
2. **Chains** (server-to-server fetch with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`):
   ```
   POST /functions/v1/vfo-admin-api
   { action: "automation_CONTRACT_stripecustomer", client_id: pipeRow.client_id }
   ```
3. Catches chain failure as non-fatal (logs and continues).

### `eventType === "Signed"` with CEO email

[Lines 64-69](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts):

The CEO email is hardcoded at line 64: `aanderson@elitert.com`. If the signer's email matches:

1. UPDATEs `pipeline_map1.c18_ceo_signed='Yes'`.
2. No chain. (The `Completed` event will fire shortly after and trigger the chain.)

### `eventType === "Signed"` with client (or any other) email

[Lines 71-91](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts):

1. **Idempotency check**: if `pipeRow.c17_client_signed === 'Yes'`, returns `200 OK` without doing anything.
2. UPDATEs `pipeline_map1.c17_client_signed='Yes'`.
3. **Chains**:
   ```
   POST /functions/v1/vfo-admin-api
   { action: "automation_CONTRACT_ceocountersign", client_id: pipeRow.client_id }
   ```

## Embedded handler step-by-step

[admin-api:544-583](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts):

Same database writes as standalone, **without the chain calls**:

- `Completed` → set both columns to 'Yes'.
- `Signed` (CEO email) → set `c18_ceo_signed='Yes'`.
- `Signed` (anyone else) → set `c17_client_signed='Yes'`.

> Notable difference: the embedded version is NOT idempotent on the `c17_client_signed='Yes'` re-signal. It happily overwrites with the same value. Functionally equivalent but means a duplicate webhook delivery would touch the same row twice.

## Tables touched

- **Read:** `pipeline_map1` (lookup by `boldsign_doc_id`).
- **Written:** `pipeline_map1` (`c17_client_signed`, `c18_ceo_signed`, `updated_at`).

## Downstream chains (standalone only)

| Event | Chain target |
|---|---|
| `Completed` | `automation_CONTRACT_stripecustomer` (which itself chains `automation_CONTRACT_paymentemail`) |
| `Signed` (non-CEO) | `automation_CONTRACT_ceocountersign` |
| `Signed` (CEO) | none — waits for `Completed` |

## Authentication

**Neither** webhook handler verifies a BoldSign webhook secret. Both accept any POST with the right body shape. Authentic-looking webhooks could in theory be forged by anyone who knows a `boldsign_doc_id` — though the actions are state mutations only on existing pipeline rows, not arbitrary inserts. Risk is bounded but worth noting.

BoldSign supports webhook secrets but this is unconfigured.

## Failure modes

1. **Wrong handler is the configured target** — if the embedded handler is configured, `c17/c18` advance correctly but `automation_CONTRACT_ceocountersign` and `automation_CONTRACT_stripecustomer` are never invoked. Pipeline stalls. Manual intervention required.
2. **Both handlers configured** — both run. The standalone runs first, chains. The admin-api embedded runs and re-writes the same columns (no-op). Probably benign but redundant.
3. **`pipeline_map1` row missing** — webhook is received before the row exists. Both handlers return 200 OK silently. The signature event is lost; admin would need to re-send the agreement.
4. **Chain call fails** (e.g., admin-api function is down, network error) — caught and logged. The DB UPDATEs already succeeded, so the column says signed but no email/customer is created. Manual replay required.
5. **Duplicate `Signed` events** — standalone handles via idempotency check. Embedded does not, but the result is the same column value, so functionally idempotent.
6. **`Signed` with unrecognized signer email** — falls through to the "client" branch and sets `c17_client_signed='Yes'`. If a third signer were ever added (currently always 2), this would misroute. Not currently an issue with the 2-signer agreement template.

## Open questions

1. Which URL is configured in BoldSign? (Cannot verify from code.)
2. Is a BoldSign webhook secret intended? Currently none configured; signature verification would be a hardening step.

## Cross-references

- Master flow: [contract-and-payment.md](contract-and-payment.md#step-5--client-signs-in-boldsign)
- BoldSign integration detail: [../integrations/boldsign.md](../integrations/boldsign.md)
- Pipeline columns: [../tables/pipeline.md](../tables/pipeline.md)
