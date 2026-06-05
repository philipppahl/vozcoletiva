# 0036 — Custom domain: vozcoletiva.com

Status: accepted · 2026-06-05

## Context

The PWA was served only on the raw `*.cloudfront.net` domain. We registered the
real domain `vozcoletiva.com` (Route 53) and need to serve the app on it over
HTTPS. CI/CD and the prod environment are a separate, later cycle — this
decision covers registration + DNS + the dev cutover only.

## Decision

### Hostname → environment mapping

| Hostname | Environment | When |
|---|---|---|
| `vozcoletiva.com` (apex) + `www` | **prod** | Phase 2 (CI/CD cycle) |
| `dev.vozcoletiva.com` | **dev** | now |

The apex is **reserved for prod** — it's "the hosted instance" per
`docs/conventions/ci.md`, and prod is CI-deploy-only. Pointing the apex at the
dev/integration build would be misleading, so the apex stays dark until prod
ships. dev gets a real, shareable HTTPS hostname now, which also exercises the
whole cert → CloudFront → DNS path before prod depends on it.

### Registration

- Registered via `route53domains register-domain` (us-east-1 — the only region
  for the Registrar API), contacts copied from an existing account domain,
  **privacy protection on**, **auto-renew on**. ~$13/yr.
- Registration auto-created the hosted zone **`Z0669703GLJFF9CB3PZR`**
  (`vozcoletiva.com`), shared across envs and pinned in `env-config.ts`.

### Certificate (us-east-1, cross-region)

CloudFront only accepts certificates from **us-east-1**, but the app stack runs
in `eu-west-1`. So each env with a custom domain gets a dedicated **`CertStack`**
in us-east-1 (`voz-<env>-cert`) holding a DNS-validated ACM `Certificate`; the
cert is handed to the app stack through CDK **`crossRegionReferences`**. We
deliberately avoid the deprecated `DnsValidatedCertificate`. Validation records
are written into the shared hosted zone, so issuance is automatic — but only
once the domain's NS delegation is live (i.e. registration has completed).

### CloudFront + DNS wiring

`WebHosting` gained optional `customDomain` / `certificate` / `hostedZone`
props. The custom-domain wiring (CloudFront `domainNames` + cert, and Route 53
**A + AAAA alias** records to the distribution) is attached **only when the cert
is present** — so cert-less synth (unit tests, `cdk diff`) still succeeds, and a
`domainName` is never set without its matching cert.

### Deploy flow

`deploy.ts` now runs `cdk deploy --all` / `cdk diff --all`. The app
(`bin/voz.ts`) only ever synthesizes the *current* `VOZ_ENV`'s stacks, so
`--all` means exactly "the app stack + its cert stack" and never reaches into
another environment. CDK orders them via the cross-region dependency.

The custom domain is the **web origin only** — the HTTP/WS API stays on its
`execute-api` URL, so the env-file the deploy script writes is unchanged.

## Out of scope (Phase 2 / later)

- Apex + `www` → prod; the prod stack; OIDC deploy roles; GitHub
  secrets/environments; branch protection; auto-deploy-on-push.
- `www` → apex redirect.
- SES / email on the domain (MX, SPF, DKIM, DMARC).

## Consequences

- dev is reachable at `https://dev.vozcoletiva.com`.
- A new us-east-1 `voz-dev-cert` stack now exists alongside `voz-dev`.
- First cert deploy waits on DNS validation (a few minutes) and on the domain
  registration having completed (NS delegation live).
- ~$13/yr registration (auto-renews) + ~$0.50/mo hosted zone.
