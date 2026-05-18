# Validation convention

Status: initial, 2026-05-18. Revise as code accumulates.

## Principle

**Validate at boundaries; trust the interior.**

Every byte of data that enters the system from outside is parsed, validated, and converted into a typed domain value at the boundary. Beyond that point, code can assume invariants hold and does not re-validate.

This is the inverse of "validate everywhere defensively." Defensive validation deep in business logic is duplication and a symptom of weak boundary types.

## Where the boundaries are

- **HTTP request bodies and query strings** (API Gateway → Lambda).
- **WebSocket message frames**.
- **Form input** in the React app.
- **API responses** the FE receives (defensive re-parse over the typed `openapi-fetch` shape — belt and braces).
- **File uploads** (size, MIME, content sniffing).
- **Environment variables and runtime config** (parsed once at startup, not per request).
- **Markdown content from users** (sanitization is a form of validation).

## Rust side

- **`serde`** for deserialization with `#[serde(deny_unknown_fields)]` where shape stability matters.
- **Newtypes for every meaningful primitive**: `UserId`, `ProjectId`, `ProposalId` (ULIDs); `Slug` (validated kebab-case); `Email` (validated, kept opaque); `ChannelName`; etc. Construction is the only way an invariant gets established.
- **`TryFrom<RawInput>` → `Verified` pattern.** Untyped input deserializes into a `Raw…` struct; conversion to the domain type does the validation. Business code never sees `Raw…`.
- **No `unwrap()` on user input**, ever. Return `Result<_, ValidationError>`.
- **Custom validators** are pure functions; reuse them via a `Validator` trait if patterns repeat.
- **Server-side markdown sanitization** via [`ammonia`](https://crates.io/crates/ammonia) on every proposal / comment / document / message write. Sanitized text is what gets stored.

## TypeScript side

- **Zod schemas at the form boundary** — react-hook-form uses the Zod resolver; failed parses become field-level errors.
- **Zod schemas at the response boundary** — even though `openapi-fetch` gives us types, parse responses through Zod for runtime safety (the spec may be ahead of the server in rare cases, or the network may corrupt).
- **Branded types** in TS where the generated OpenAPI types fall short: `type ProjectId = string & { readonly __brand: 'ProjectId' };`.
- **No `any`** in validation code. `unknown` until proven typed.
- **Client-side markdown sanitization** via `rehype-sanitize` on every render — the second wall over server-side `ammonia`.

## Sensitive content

- **Passwords**: handled by Cognito only. Never logged, never stored in our DDB, never round-tripped.
- **Tokens** (API tokens, push-subscription auth keys): server-side only; never round-tripped to the frontend after issuance.
- **Email**: stored only in Cognito; not duplicated in our DDB; never appears in keys or logs.

## Anti-patterns

- Validating the same input twice "just to be safe." One canonical validator per boundary.
- "Defensive" `Option::unwrap_or_default()` that hides shape mismatches. Make it `Result` and surface the failure.
- Accepting a `String` where you mean an `Email` or `Slug`. Newtypes are cheap; primitive obsession is not.
- Parsing user-provided HTML on the client without sanitization.
- Server "trusts the client" because the spec says X. Belt and braces — re-validate.

## Worked example — Rust boundary

```rust
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawCreateProposal {
    title: String,
    body: String,
    voting_mode: String,
    ends_at: String,
}

pub struct CreateProposal {
    pub title: ProposalTitle,
    pub body: SanitizedMarkdown,
    pub voting_mode: VotingMode,
    pub ends_at: DateTime<Utc>,
}

impl TryFrom<RawCreateProposal> for CreateProposal {
    type Error = ValidationError;

    fn try_from(raw: RawCreateProposal) -> Result<Self, Self::Error> {
        Ok(Self {
            title: ProposalTitle::parse(raw.title)?,
            body: SanitizedMarkdown::parse(raw.body)?,    // runs ammonia
            voting_mode: raw.voting_mode.parse()?,
            ends_at: DateTime::parse_from_rfc3339(&raw.ends_at)?.with_timezone(&Utc),
        })
    }
}
```

## Worked example — Zod form schema

```ts
const createProposalSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(50_000),
  votingMode: z.enum(['simple', 'absolute', 'qualified_two_thirds', 'consensus']),
  endsAt: z.string().datetime(),
});

type CreateProposal = z.infer<typeof createProposalSchema>;
```

## Cross-references

- `clean-code.md` § *Types First* — newtype-everything thesis this builds on.
- `docs/frontend-stack.md` — Zod + RHF + react-markdown picks.
- `docs/data-model.md` — newtype IDs serialise into DDB as their string form.
- `docs/conventions/testing.md` — how to test boundary parsers (property tests pay off here).
