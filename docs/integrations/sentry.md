# Sentry (frontend error monitoring)

Added 2026-06-18 (security remediation, item **H3**). Sentry is the only **frontend-side** external integration — every other integration in this folder is consumed by the edge functions. Its sole job is to capture uncaught JavaScript/React errors from the deployed SPA so a render crash that used to vanish into a blank screen now produces a report.

## What's wired

| Where | What |
|---|---|
| `package.json` / `package-lock.json` | dependency `@sentry/react` |
| [`src/main.jsx`](../../src/main.jsx) | `Sentry.init({ dsn, environment: 'production', enabled: import.meta.env.PROD, ignoreErrors: [...] })` at startup, before the app renders |
| [`src/components/ErrorBoundary.jsx`](../../src/components/ErrorBoundary.jsx) | `componentDidCatch` calls `Sentry.captureException(error, { extra: { componentStack } })` — React render crashes are caught by the boundary and don't reach the global handler, so they're reported explicitly here |

## Scope (deliberately minimal)

`Sentry.init` passes the DSN + `environment` plus two hygiene options added 2026-07-08 (gotcha #194):

- **`enabled: import.meta.env.PROD`** — before this, `npm run dev` sessions reported every hot-reload error of in-progress code to the same dashboard tagged `environment=production` (9 phantom "production" issues were triaged 2026-07-08; all proved to be dev noise or transient mid-edit bundles, none in shipped code). Vite sets `PROD` only in `vite build`, i.e. what `npm run deploy` ships — dev sessions now report nothing. Diagnosis tip for pre-fix events: check the event's `url` tag; `localhost:5173` = dev noise.
- **`ignoreErrors: [/non ISO-8859-1 code point/]`** — filters browser-extension fetch calls that surface through Sentry's fetch-breadcrumb wrapper misattributed to the app bundle (no app fetch puts dynamic data in a header; all headers in `src/` are static constants).

There is intentionally:

- **No Session Replay** — would record the DOM/inputs and capture client PII.
- **No performance tracing / `tracesSampleRate`** — not needed, and keeps the project within Sentry's free tier.

So Sentry receives error events only (the global handler plus the explicit `captureException` from the error boundary), and only from production builds. It does not see normal user activity, network payloads, or session data.

## The DSN is not a secret

The DSN is hardcoded in [`src/main.jsx`](../../src/main.jsx):

```
https://8901dcdcf290d054228b1611f2a929ec@o4511588768088064.ingest.us.sentry.io/4511588781654017
```

A Sentry DSN is a **public, ingest-only** key — it can only *send* error reports to this one project, never read anything back. It is safe to ship in client source, the same way the Supabase **anon key** is (see [env-vars.md](env-vars.md)). It is **not** stored in an environment variable, so there is nothing to add to the env-var inventory as a secret; rotating it (e.g. via Sentry's "new client key") means editing source + redeploying, just like the anon key.

## Cross-references

- The error boundary + init wiring: [../architecture/02-frontend-shell.md](../architecture/02-frontend-shell.md) ("Error UX")
- Env-var inventory (why the DSN isn't listed as a secret): [env-vars.md](env-vars.md)
