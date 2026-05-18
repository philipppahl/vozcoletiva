# Testing convention

Status: initial, 2026-05-18. Revise as code accumulates; principles over command incantations.

## Goals

- Tests reveal regressions early.
- Tests document behaviour — they read like a spec.
- Tests are reliable: green means safe to merge.

## The pyramid

- **Most**: unit tests. Fast, isolated, plentiful.
- **Some**: integration tests against real infrastructure (**DynamoDB Local**, S3 stub, …). Never mocks for system-of-record behaviour.
- **Few**: end-to-end tests through the browser. One happy path per critical flow; not exhaustive.

## Per-language tooling

### Rust (backend)

- **Unit**: `#[test]` with `cargo test`. Pure-logic functions, newtype invariants, parsers, codecs, sanitization, validators.
- **Async**: `#[tokio::test]` for async handlers and clients.
- **Integration**: `tests/` directory; runs against **DynamoDB Local** in a docker-compose harness. The test setup spawns the local DDB, creates the single table, seeds fixtures, runs the test, tears down.
- **Property**: [`proptest`](https://crates.io/crates/proptest) for things with rich invariants (vote tallies, ULID round-trip, validator inputs, sanitizer output). Treat shrinking failures as authoritative bug reports.
- **Concurrency**: [`loom`](https://crates.io/crates/loom) for permutation testing where shared mutable state is unavoidable.

### TypeScript (frontend + infra)

- **Unit / component**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/). Test **behaviour** ("clicking the vote button submits the right payload"), not implementation ("calls `setState`").
- **E2E**: [Playwright](https://playwright.dev/) — mobile viewport by default; desktop secondary. Visual regression snapshots only for layout-critical surfaces (login, inbox, proposal page).
- **CDK stack tests**: assertions on the synthesized template (`Template.fromStack(...)`). One test per stack exercising its key constructs.

## What to test

- All public functions / methods / API endpoints.
- Boundary conditions: empty, single, max, off-by-one, negative.
- Invariants: a passed proposal cannot revert; a vote cannot count twice; vote tally = sum of vote events.
- Failure paths: the unauthorised user, the missing record, the malformed input.
- Concurrency: simultaneous votes, race conditions in tally update.

## What NOT to test

- Third-party library internals.
- Generated code (e.g. `packages/api-client`) — trust the codegen, test the inputs.
- Pure-output framework behaviour (e.g. that React renders a `<div>`).
- Private internals where the public test already covers behaviour. Refactor-proof your tests.

## Mocks policy

- **Default: do not mock.**
- For HTTP boundaries we own (DynamoDB, Cognito, S3, SES), prefer the real local emulator or a documented test double we author.
- For HTTP we don't own (external integrations, push services), use [`wiremock`](https://crates.io/crates/wiremock) (Rust) or [MSW](https://mswjs.io/) (TS).
- **Never mock the system-of-record.** DDB behaviour is the contract; mocking it hides bugs.

## Fixtures and factories

- Rust: builder pattern — `ProposalBuilder::new().voting().build()`. One per aggregate.
- TS: factory functions returning typed payloads — `makeProposal({ status: 'voting' })`.
- Fixtures live next to the tests that use them (`tests/fixtures/`), not in a global file.
- Test data is **never** PII. Faker-generated names and `@example.com` emails only.

## Snapshot tests

- Allowed for: rendered HTML of stable surfaces, sanitized markdown output, OpenAPI snapshots.
- Snapshots are **reviewed**, not rubber-stamped on every failure. A diff-flagged change is a request for thought.
- One snapshot per behaviour, not per render path.

## E2E budget

Aim for **5–8 Playwright flows** covering critical paths only:

- Sign up + email verify.
- Sign in.
- Create project + invite + accept invite.
- Create proposal + vote + see result.
- Post a comment + receive notification.

Resist the urge to E2E feature-level behaviour. Unit tests are faster, more focused, easier to maintain.

## Manual UI verification (the last gate)

Automated tests catch what they were written for. They do **not** catch:

- Visual regressions outside whatever a snapshot covers — layout drift, padding accidents, brand-token misuse, contrast failures.
- Dark-mode bugs that only show up against actual dark surfaces.
- "Feels wrong on a real phone" — touch-target spacing, scroll behaviour, keyboard avoidance, swipe-back conflict.
- Console warnings the test runner doesn't fail on.
- Localisation breakage (overflowing PT strings, untranslated copy).

**Every UI-affecting change is opened in a real browser before it is declared done.**

### Protocol

1. **Start the dev server** (`bun dev` on the relevant app workspace).
2. **Mobile first.** Open at a mobile viewport (390×844 baseline) — DevTools device emulation or a real device on the LAN.
3. **Golden path.** Walk through the primary flow end to end.
4. **One edge case.** Empty state, validation failure, slow-network throttle, offline — whichever is most relevant to the change.
5. **Light + dark.** Toggle both themes. Brand contrast and surface tokens hold.
6. **Keyboard + touch.** Tab order is sane; tap targets at least 44×44.
7. **Console clean.** No new errors; no new warnings.
8. **Languages.** EN **and** PT once translations are wired (until then, EN only).
9. **Desktop sanity check.** Briefly verify desktop doesn't regress.

### When to skip

Pure backend / infra / docs / tooling changes with **zero UI surface** — the Summary should state "no UI surface — verification gate not applicable."

### Relationship to Playwright

- **Playwright** = automation that prevents *specific known* regressions from coming back.
- **Manual UI verification** = discovery that finds *new* ones.

Both are required; neither replaces the other.

### Relationship to `plan-feature`

The `plan-feature` skill requires the execution-turn Summary to include a *UI verification* block when the change touches UI. See `.claude/skills/plan-feature/SKILL.md` § *UI verification gate*.

## CI execution

- **On PR**: unit + integration (Rust + TS).
- **On PR (slow lane)**: Playwright on mobile viewport.
- **On push to `main`**: full suite, gating dev + prod deploy.
- **Runtime budget**: PR stages combined under **8 minutes** wall time.

## Test data hygiene

- No production data in tests, ever.
- No real emails / real user names / real payment data.
- No long-lived test accounts in shared envs without a named owner.

## Worked example — Rust unit

```rust
#[test]
fn vote_change_records_previous_choice() {
    let proposal = ProposalBuilder::new().voting().build();
    let mut tally = Tally::new(&proposal);

    let event = tally.cast(user_a(), Choice::Yes).unwrap();
    assert_eq!(event.previous_choice, None);

    let event = tally.cast(user_a(), Choice::No).unwrap();
    assert_eq!(event.previous_choice, Some(Choice::Yes));
    assert_eq!(tally.yes(), 0);
    assert_eq!(tally.no(), 1);
}
```

## Worked example — Vitest + RTL

```ts
test('clicking vote-yes submits the choice', async () => {
  const submit = vi.fn();
  render(<ProposalVoteCard proposal={makeProposal()} onVote={submit} />);

  await userEvent.click(screen.getByRole('button', { name: /vote yes/i }));

  expect(submit).toHaveBeenCalledWith({ choice: 'yes' });
});
```

## Cross-references

- `clean-code.md` § *Tests* — the broader philosophy this convention concretises.
- `docs/conventions/ci.md` — when each test layer runs.
- `docs/conventions/validation.md` — how to test boundary parsers.
