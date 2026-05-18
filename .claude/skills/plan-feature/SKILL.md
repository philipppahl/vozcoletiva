---
name: plan-feature
description: Use this skill at the start of any feature, fix, or non-trivial change. Produces a structured plan and refuses to write code until the human approves the plan. The implementation cycle gate.
---

# plan-feature

The implementation cycle gate. **Refuses to produce code on the first turn.** Produces a structured plan; waits for explicit human approval; only then is code allowed.

## When to use

Trigger this skill at the start of any:

- New feature, however small
- Non-trivial bug fix (anything beyond a one-line typo)
- Refactor that touches more than one file
- Schema or API change (DynamoDB access pattern, HTTP / WebSocket endpoint shape)
- New event type (audit, operational, push notification)
- New CDK stack or stack change with infra impact
- New skill being added to `.claude/skills/`
- New convention being added to `docs/conventions/`

Do NOT trigger this skill for:

- Pure questions / explanations
- Pure file moves or renames the human has already explicitly directed
- Trivial typo fixes
- Editing `VISION.md` or other docs without code impact

## The cycle (non-negotiable)

1. **Plan.** Produce the plan in the structure below. **Do not write code.** Do not create files other than the plan itself if requested.
2. **Wait.** End the plan with an explicit `## Approval needed` block listing decisions the human must confirm. Do not proceed past this point until acknowledged.
3. **Execute.** Once approved, follow the plan. Surface deviations explicitly when they happen — never silently expand scope.
4. **Summary.** End with what changed, what tests pass, what's left, what's deferred. Cross-reference the original plan.

## Plan structure

A plan must contain these sections, in this order:

```
## Goal
[One or two sentences. What outcome are we producing?]

## Scope
- In: [bullet list of what is being built]
- Out: [bullet list of what is explicitly NOT being built — adjacent things you might be tempted to grab]

## Files touched
| File | Action | Why |
|---|---|---|
| path/to/file | new / modify / delete | one-line reason |

## Types and modules
- New types / structs / enums introduced (Rust + TS)
- New modules / crates / packages
- Existing types being modified (with backward-compat note if relevant)

## API surface
- New HTTP endpoints (method, path, request/response shape)
- New WebSocket message types
- OpenAPI / AsyncAPI sections affected
- Auth scopes required
- Backwards-compat note if breaking

## Data model
- DynamoDB access patterns affected (PK/SK shape, GSI usage)
- New entity types in the single-table design
- Migration considerations (backfill, dual-write window)

## Tests
- Unit tests to add (per file or per module)
- Integration tests (per service boundary affected)
- E2E browser flows (Playwright) if user-facing UI changes
- Property tests (if pure-logic with rich input domain)

## Events to log
- Operational logs (info-level business events)
- Audit events (vote casts, vote changes, role changes, moderation actions, document amendments, invite issuance / use)
- Push notification triggers (if any)
- All event names follow the existing taxonomy; new event types need a one-line entry in the event catalogue

## Docs to update
- `VISION.md` (only if scope or product shape changes)
- `docs/conventions/*` (if new conventions emerge)
- `docs/decisions/*` (if a new architectural decision is being made)
- `brand/*` (if branding / palette evolves)

## Risks
- Things that could go wrong during execution
- Things that could be wrong about the plan itself
- Dependencies on unresolved questions (cross-reference VISION § Open questions or decisions log)

## Effort
- Rough estimate: small (< 1 hour) / medium (half-day) / large (multi-day)

## Approval needed
- Confirm scope is right
- Confirm file list is complete
- Confirm tests are sufficient
- [Plus any plan-specific decisions, e.g. "is it OK to break X by changing Y?"]
```

## Checks before declaring "plan complete"

Before ending your plan-producing turn, verify:

- [ ] Every bullet in Scope/In has a corresponding entry in Files Touched
- [ ] Every new entity in Files Touched is reflected in Types and Modules
- [ ] Every state-bearing operation has an API entry (no backdoor mutations — the API surface section names every new / changed endpoint)
- [ ] Tests cover the new types and the new behaviour, not just the existing surface
- [ ] At least one event is logged for every new business action
- [ ] Docs section is non-empty (a meaningful change affects at least one doc)
- [ ] Approval needed block names the specific decisions the human is being asked to confirm — not just "approve?"

If any check fails, fix the plan before sending.

## Common pitfalls

- **Scope creep dressed as "small adjacent work."** If you find yourself adding "and also fix X" or "while we're here, refactor Y" — STOP. Either it belongs in the plan as a separate scope item with its own analysis, or it's out of scope for this feature.
- **Vague file lists.** "Touch the auth service" is not a file list. Name the files.
- **Skipping the events section.** Every new business action must log. Don't defer event design to "after the code is done" — that's how event taxonomies drift.
- **Skipping the API section.** If a change adds or modifies state, it goes through the API. Naming the endpoint in the plan is what enforces API-first (CLAUDE.md § *API-first*).
- **Handwaving the tests.** "Add tests" is not a test plan. Name the tests, what they cover, what they don't.
- **Producing the plan and then immediately writing code in the same turn.** The gate is *between* turns, not within one. End the planning turn after the Approval needed block. Wait for human acknowledgement.
- **Treating the plan as immutable.** If during execution you discover the plan was wrong, surface it explicitly: "the plan said X but I've discovered Y. Should I revise?" Don't silently deviate.

## Output format on the planning turn

Markdown. The plan IS the output. No code. End the turn after the Approval needed block.

## Output format on the execution turn

Code changes via Edit / Write. Final message follows the Summary structure described in `CLAUDE.md`.
