# vozcoletiva — Vision

A mobile-first PWA for structured collective decision-making. Projects host topics; topics host proposals; members agree, disagree, fork, discuss, and decide under a chosen voting rule within a fixed runtime.

Inspired by LiquidFeedback. Built to feel as light as a chat app on a phone, with the rigor of a formal voting system underneath.

Domain: **vozcoletiva.com**.

---

## Principles

- **Mobile-first, then everything else.** Designed for the phone; desktop is a side benefit.
- **Boring to use, rigorous underneath.** A new member can vote on something within 60 seconds of opening the app. The math and the audit trail are still honest.
- **Private by default.** Projects are opaque to outsiders unless explicitly opened.
- **Public votes by default.** Decisions a group makes together are accountable to that group.
- **Calm notifications.** The user controls what pings them. The system defaults to "few, relevant."
- **Open at the seams.** Data is exportable; participation is portable.
- **API-first.** Every action in the UI is a call to the public, typed, versioned API. The webapp is the first client, not the only one.

---

## Distribution & openness

- **Open source.** The project itself is open source. Governance tools require trust; auditable code is the lowest bar.
- **One hosted instance.** `vozcoletiva.com` is the canonical hosted instance, operated as the public service. Anyone can sign up (no waitlist, no approval) — but joining a specific *project* still depends on that project's invite or join rules.
- **Self-hosting is not designed for.** If the open-source code makes it possible for others to run their own instance, fine; product decisions are not constrained by that case.

---

## Domain model

### Project
A bounded community of members making decisions together. Examples: a co-op, a sports club, a residents' association, an open-source project, a household.

- **Visibility**: Private (default) | Public.
  - Private: not listed; join by invite only (link or short code), or by approval after a direct request.
  - Public: discoverable; anyone with an account can request to join (admin approval optional).
- **Roles** (most → least privileged):
  - **Owner** — creator (unique per project). All permissions. Can transfer ownership. Can delete the project.
  - **Admin** — manages project settings, topics, channels, members, and invite links. Cannot delete the project.
  - **Moderator** — handles reports; can hide comments/messages and suspend members. No settings access.
  - **Member** — full participation: vote, comment, propose, chat.
  - **Observer** — read-only: sees proposals, comments, and chat; cannot vote, comment, propose, or send chat.
- **Joining**: via invite (private) or by request / open-join (public).
- **Settings**: default voting mode, default runtime, default quorum, notification baseline, language, code of conduct text.
- **Templates** (at creation): pick a starter — Co-op, Sports Club, Open Source, Residents' Association, or Custom — that pre-fills sensible defaults (voting mode, runtime, suggested topics, code-of-conduct stub). Everything is editable afterwards.

### Topic
A folder inside a project, used to group proposals by area (e.g. "Finance", "Events", "Bylaws"). Topics are optional — small projects can keep everything at project root.

### Channel
A real-time chat channel scoped to a project, for fast, low-formality conversation that sits alongside the formal proposal/comment thread. Every project ships with a default `#general`; admins may add more (e.g. `#announcements`, or per-topic mirrors).

### Proposal
The unit of decision. Carries a **type** that drives its ceremony and the shape of its outcome.

- **Type** (set at creation):
  - **Decision** — yes/no on a question. The default.
  - **Document** — proposal text becomes a canonical, versioned document if accepted; lives on in the Document Library.
  - **Election** *(post-MVP)* — vote people into roles. Candidates nominated or self-nominated; single- or multi-winner; optional term length.
  - **Poll** *(post-MVP)* — pick one or more from a co-created option list (upfront list, distinct from forks).
  - **Petition** *(post-MVP)* — gather support, non-binding; optional threshold to auto-promote to a Decision.
- Title, body (Markdown), author, created/updated timestamps.
- **Voting mode** (set at creation): consensus | simple majority | absolute majority | qualified majority (2/3, 3/4, configurable).
- **Runtime**: optional discussion window + voting window with explicit end date/time.
- **Quorum**: optional minimum participation for validity.
- **Status**: draft → discussion → voting → closed (passed | rejected | quorum failed | withdrawn).
- **Relationships**: fork-of, alternative-to, supersedes, **amends** (Document type only — targets an existing `DocumentVersion`).
- **Fork mode** (set on parent, configurable, default independent):
  - *Independent*: each fork is its own yes/no decision; multiple may pass.
  - *Competing*: forks form a ranked group; one wins via a ranked method (Schulze planned).

### Vote
- Choice: yes | no | abstain. In competing mode: rank or score.
- Publicity: public to project members by default; project can opt into pseudonymous votes (tallies stay public, attribution hidden).
- Mutable while the voting window is open; immutable after close. Vote changes are recorded in the audit log.

### Comment
- Markdown, with `@mentions` and reactions.
- Threaded: comments can reply to comments, forming a tree to branch discussion.
- Soft-deletable by author or moderator; tombstone preserves thread shape.
- Short edit window; later edits leave an "edited" marker.

### Message
A chat message in a channel. Carries text (Markdown), and/or attachments: image, voice note. Supports single-level reply-to, reactions, short edit window, soft-delete. Lighter-weight than a `Comment` — no nesting tree, no audit-trail requirement.

### User
- Identity: real name optional; display name required.
- Email-verified via Cognito.
- Per-project nickname allowed (where the project permits it).
- Profile is project-scoped — no global profile page.

### Invite
A token granting the bearer the ability to join a specific project on the issuer's terms.

- Created in-app by an Owner or Admin (*Project → Members → Invites*). A prominent "Invite people" entry sits in the project's main navigation so it is easy to find — never buried.
- Each invite has two equivalent forms:
  - **Shareable URL** (e.g. `vozcoletiva.com/i/<token>`), suitable for messengers / email.
  - **Short typeable code** (e.g. 8–10 chars), suitable for verbal or offline sharing.
- Per-invite settings:
  - **Role on join**: Member (default) or Observer.
  - **Expiry**: none | 1h | 1d | 7d | custom.
  - **Max uses**: 1 | N | unlimited.
  - **Note**: free-text reminder so the issuer knows what the invite was for.
- **Revocable** at any time.
- **Audit**: who issued it, when, and who joined via it.
- Joining a project via invite always confirms the role being granted before the user accepts.

### Document
The canonical artifact produced when a Document-type proposal is accepted. Versioned, addressable, lives on after the proposal closes.

- One Document per originally accepted Document proposal (plus its accepted amendments).
- Current state = latest accepted `DocumentVersion`.
- Permanent URL; full-text searchable within the project.
- Exportable (Markdown in MVP; PDF post-MVP).

### DocumentVersion
A snapshot of a Document's text at a specific accepted version, with a diff against the previous version. Each accepted amendment produces a new version; prior versions remain addressable for citation and historical reference.

### Collection *(post-MVP)*
A user-curated, ordered grouping of Documents (e.g. "Statutes", "Policies"). A Document may belong to multiple collections. Collections are scoped to Documents only — accepted Decisions and Elections live in their own per-project histories.

---

## Voting modes

| Mode | Passes if |
|---|---|
| Simple majority | yes > no |
| Absolute majority | yes > 50% of all eligible members |
| Qualified majority | yes ≥ configured threshold (e.g. 2/3, 3/4) of votes cast |
| Consensus | no "no" votes among participants (abstain allowed) |

Any mode can be combined with a quorum (minimum participation %).

---

## Proposal lifecycle

```
draft → discussion (optional) → voting → closed
                                       ├ passed
                                       ├ rejected
                                       ├ quorum failed
                                       └ withdrawn
```

- Author edits freely in draft. After publishing, edits to substantive fields **reset the vote tally** and **notify every voter** so they can re-vote on the new version. A version history is kept for the audit trail (each accepted edit becomes a `DocumentVersion`-style snapshot).
- Author can withdraw before voting closes.
- Forking is allowed during discussion, and during voting if the parent permits it.

---

## Delegation *(vision, not MVP)*

Liquid democracy: a member may delegate their vote to another member they trust.

- Scope: per-project, per-topic, or per-proposal (most specific wins).
- Transitive: a delegate's vote may itself be delegated; cycles are broken at detection.
- Revocable at any time. A direct vote on a specific proposal overrides delegation for that proposal.
- Delegations are visible to project members (transparency over secrecy).

---

## Comments & discussion

- Threaded by reply (tree, not flat).
- Markdown rendering with safe HTML; link previews off by default.
- `@mention` notifies the mentioned member (subject to their settings).
- Reactions: small set (final emoji set TBD) for low-friction signal.
- Reporting: any member can report a comment; goes to the project moderator queue.

---

## Group chat

Each project has one or more **chat channels** for fast, low-formality conversation. Chat is intentionally separate from proposal comments — comments stay decision-anchored and threaded; chat is quick and flat.

- Channels scoped to a project. Default `#general`; admins may create more (e.g. `#announcements`, per-topic mirrors).
- Messages support:
  - **Text** (Markdown, `@mentions`, reactions, single-level reply-to).
  - **Image attachments** (JPEG, PNG, WebP). On-device compression before upload; thumbnail + full variants stored.
  - **Voice notes** (push-to-talk recording in-app, async). Capped at a sensible length (≈ 2 min). Stored as Opus/WebM, with AAC fallback if older Safari compatibility forces it.
- Real-time delivery over the same WebSocket pipe as live tallies.
- Read state: simple last-read marker per user per channel.
- **Mute-by-default** for chat notifications outside of `@mention` and direct replies — chat is high-volume and the calm-notifications principle wins.
- Search across message text within a project.
- Attachments stored in S3, served via short-lived presigned URLs; originals encrypted at rest.

**Out of scope (for now):** live voice/video calls, screen share, end-to-end encryption.

---

## Document Library

Accepted **Document**-type proposals become canonical artifacts in the project's **Document Library**.

- Each accepted Document creates a new library entry (first `DocumentVersion`).
- An accepted **amendment** (a Document proposal targeting an existing Document) produces a new version, with a diff visible against the previous.
- Permanent, addressable URL per Document and per Version — safe to cite externally.
- Full-text searchable across the project library.
- Exportable as Markdown (MVP); PDF (post-MVP).

**Collections** *(post-MVP)* are user-curated, ordered groupings (e.g. "Statutes", "Policies", "Mission"). A Document may appear in multiple collections. Collections hold Documents only — accepted Decisions and Elections are preserved in their own per-project histories rather than here.

---

## Notifications

Channels:
- **Web Push** (VAPID) — primary, works on mobile PWA and desktop browser.
- **In-app** notification center — always on.
- **Email digest** — optional fallback (immediate, daily, weekly, off).

Per-user, per-project, per-event-type settings. Event types:
- New proposal in a project/topic I follow
- Vote cast on a proposal I authored or follow
- Comment on a proposal I authored or follow
- Reply to my comment
- `@mention` (in comment or chat)
- Reply to my chat message
- Proposal entering voting / about to close (configurable lead time)
- Proposal result

Defaults are quiet; each project offers a one-tap baseline (silent / standard / verbose).

---

## Home & inbox

The default screen when a member opens the app is a **personal inbox**, not a project landing page.

- Cross-project view of items needing the user's attention:
  - Open votes closing soon
  - `@mentions` (in comments or chat)
  - Replies to my comments or chat messages
  - Results of proposals I follow
- Project switcher prominently available at the top.
- "All quiet" empty state when nothing needs attention — by design, not a bug.

Per-project views remain one tap away via the switcher.

---

## Privacy, moderation, abuse

- **Vote privacy default**: public to project members. Project setting can switch to pseudonymous (random per-proposal token).
- **Profile data**: minimal. Email is private; display name is project-visible.
- **GDPR**: full machine-readable export. Account deletion offers two modes — hard delete (cascades) or anonymize-but-preserve-vote (replaces identity with "[former member]" so historical tallies remain valid).
- **Moderation**: per-project moderator role; report queue; ability to hide comments, remove proposals (with audit trail), suspend members.
- **Anti-abuse (MVP)**: email verification, basic rate limits on proposal/comment creation, captcha on signup. Stronger sybil resistance (phone, vouching) deferred.

---

## Internationalization

- Launch languages: **English, Portuguese**.
- Locale picked per user; fallback per project; final fallback to browser locale.
- User-generated content stays in whatever language it was written; UI chrome is translated.
- Date/time formatting and timezones respected per user.

---

## Accessibility

- Target WCAG 2.2 AA.
- Full keyboard navigation; visible focus states.
- Screen-reader-friendly labels on interactive elements.
- Sufficient contrast in light and dark themes.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.

---

## API-first & integrations

- **One API.** The webapp is the first client; every UI action is a call to the public, typed API. No backdoor "internal" endpoints — the team eats its own dog food.
- **Specs as build artifacts.** OpenAPI for HTTP, AsyncAPI for the WebSocket surface — generated from the Rust handlers, not hand-maintained.
- **Auth:**
  - In-app: Cognito session.
  - External / automation: **scoped API tokens** *(post-MVP)* issued per project, with permission scopes (read, write, moderate, admin). Listed and revocable from the project's API settings page.
- **Versioned** (`/v1`, `/v2`, …) with an explicit deprecation policy (`X-Deprecated` header, sunset date).
- **Webhooks** *(post-MVP)*: project-level outbound subscriptions to events (proposal published, vote cast, proposal closed, message posted, document amended, …). HMAC-signed payloads.
- **Audit log** records the calling user **and** the calling token, so automation activity is traceable.
- **MCP server** *(post-MVP)* wraps the same API — strictly a tool-protocol adapter; no parallel business logic.

---

## Tech stack

### Frontend
- React + Vite, TypeScript.
- PWA via service worker (Workbox), installable on iOS and Android browsers.
- Web Push via standard `PushManager` + VAPID.
- State management: small, library TBD (Zustand likely).
- Styling: light + dark mode, system-preference-aware, manual override.

### Backend
- AWS, fully serverless.
- **Rust on AWS Lambda** (small cold starts, low cost at scale).
- **DynamoDB** as system of record. Single-table design as default; separate tables only where access patterns truly justify it.
- API: HTTP API via API Gateway for request/response; WebSocket via API Gateway for live tally and comment updates.
- Auth: **Amazon Cognito**, email + password to start; OAuth providers later.
- Push delivery: direct Web Push (VAPID) — PWA-only initially.
- Email: SES (transactional + digests).
- **Media storage**: S3 for chat images and voice notes (and any future proposal/comment attachments). Uploads via presigned PUT URLs from Lambda. Originals encrypted at rest; read URLs short-lived. Optional Lambda for thumbnail generation and (only if needed) voice format transcode.
- IaC: **AWS CDK**, with a thin `deploy` script taking an `--env` flag (e.g. `--env dev`, `--env prod`) that maps to per-environment stack parameters (account, region, domain, branch, scaling caps).
- **Scheduled actions** (proposal close, vote-closing-soon reminders, time-bound state transitions): EventBridge Scheduler. Per-proposal one-shot schedules created when voting opens; cancelled if withdrawn, rescheduled if the voting window changes.
- Observability: CloudWatch + structured logs + X-Ray traces.

### Data approach
- Append-friendly: votes and vote changes are events; current state derived/materialized.
- Audit log of votes and moderation actions is a first-class store, not a debug nicety.

---

## Non-functional targets

- p95 cold request under 500ms on Lambda.
- Time-to-interactive on a mid-tier Android phone over 4G under 3s.
- Read-only works offline; writes queue and sync when online.
- Zero personally identifiable data in logs.

---

## MVP scope

**In:**
- Sign up / sign in (Cognito, email).
- Create a private project (creator becomes Owner).
- In-app invite link management: create / revoke, configurable expiry and max uses, role-on-join (Member or Observer).
- All five roles (Owner / Admin / Moderator / Member / Observer) defined in the data model from day one; UI assignment for Admin and Moderator can land iteratively (Owner + Member + Observer surfaced first).
- **Project templates** at creation (at least 2–3 starters; Custom always available).
- Topics inside a project (flat, no nesting yet).
- Proposal types: **Decision** and **Document**.
- Create proposal: type, title, body, voting mode (majority + 2/3), runtime, quorum.
- Vote: yes / no / abstain. Votes public to members.
- Flat comments (threading layered next).
- Independent forks (competing forks deferred).
- **Document Library**: accepted Documents land as versioned, addressable entries; amendments produce diff'd new versions; Markdown export.
- **API-first foundations**: every UI action goes through the public API; OpenAPI spec generated from handlers. (Scoped tokens, webhooks, and MCP land in later iterations.)
- **Personal inbox** as the app's home screen (open votes, mentions, replies — cross-project) + project switcher.
- Web Push + in-app notifications with sensible defaults.
- EN + PT.
- Light + dark mode.
- PWA installable.

**Out (vision, post-MVP):**
- Delegation / liquid democracy.
- Competing-fork mode (Schulze).
- Proposal types: Election, Poll, Petition.
- Document Collections (curated groupings).
- Document PDF export.
- Scoped API tokens for external use; outbound webhooks.
- MCP server wrapping the API.
- Threaded comments.
- Group chat (text + image + voice notes).
- Pseudonymous vote mode.
- Public / discoverable projects.
- Email digest channel.
- Per-project nicknames.
- OAuth sign-in providers.
- Stronger sybil resistance.

---

## Open questions

- Single-table DynamoDB schema sketch.
- Push delivery path (direct Web Push vs. SNS Mobile Push).
- Reaction set finalization.
- Moderation thresholds (auto-hide vs. queue).
- Brand visuals (logo, palette, typography).
- Chat: live voice/video calls — never, or someday?
- Whether to also allow image/voice attachments on proposals and comments (not only chat).
- **Sustainability model** for the hosted instance — free / donation-supported / freemium / paid? Doesn't need to be solved before MVP but constrains scope.

---

*Status: vision draft, 2026-05-17.*
