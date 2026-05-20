# vozcoletiva — design brief

A brief for the designer. It describes the product and its features. It deliberately avoids prescribing how those features should look, where they should live on screen, or how the user should navigate between them. Those are the design problems to solve.

---

## What vozcoletiva is

A web application where members of a group make collective decisions together. They propose things, discuss them, and vote on them under a chosen rule within a fixed time window. The outcome becomes the group's official record.

## Who uses it

Members of groups, typically 5 to 500 people. Examples: co-ops, sports clubs, residents' associations, open-source projects, unions, households. Non-technical adults. Many will be on a phone.

---

## Features (what members can do)

### Account

- Sign up with email + password; verify via a 6-digit code sent by email.
- Sign in, sign out.
- Choose a display name at sign-up.
- One account per email. The same account can belong to multiple groups.

### Groups (called "projects" in the product)

- Create a project (name + a URL-friendly identifier).
- Belong to many projects independently.
- Each project is private by default — joining requires an invite.
- Within a project, members have one of five roles:
  - **Owner** — the creator; full powers; one per project.
  - **Admin** — can manage members, settings, and invites.
  - **Moderator** — can hide or remove comments; cannot change settings.
  - **Member** — can do everything functional: propose, vote, comment.
  - **Observer** — can read everything but not act.

### Invitations

- Owners and Admins can issue invitations. Each invitation:
  - Grants a specific role on join.
  - Has an optional expiry date.
  - Has an optional maximum number of uses.
  - Carries an optional free-text note for the issuer's own reference.
- Each invitation exists in two equivalent forms:
  - A shareable URL link.
  - An 8-character code that can be read aloud or written on paper.
- Owners and Admins can revoke any active invitation.
- A signed-in user follows an invitation (link or code) to join the project.

### Member directory

- Within a project, see the list of members and their roles.

### Proposals

- Any member can create a proposal with:
  - A title.
  - A body written in markdown.
  - A **voting rule**: today, simple majority (yes > no) or two-thirds (yes ≥ 2/3 of yes+no). More rules are planned (see future capabilities).
  - A **runtime**: how long voting stays open.
  - An optional **quorum**: the minimum number of voters for the result to count.
- A proposal has one of these states:
  - **Voting** — open for votes; time-limited.
  - **Passed** — the chosen rule was satisfied at close.
  - **Rejected** — the rule was not satisfied at close.
  - **Quorum failed** — too few people voted by close.
  - **Withdrawn** — the author cancelled before close.
- Members can see proposals within a project, including their state and the time remaining for those still open.
- The author can withdraw a proposal before close.
- The author can edit a proposal (planned). Editing the substance after voting has opened resets the tally and notifies every voter to re-vote on the new version.

### Branching (forking proposals)

A proposal can have variants, called **forks**. A fork is a new proposal that references an existing one, typically with modified text or parameters. Forking is how a member responds with an alternative instead of only voting against.

- Any member can fork any open proposal in their project.
- A fork inherits the parent proposal's text by default; the forker edits it before publishing.
- A fork can itself be forked. The result is a tree of variants rooted in an original proposal.
- The relationship is part of the record — a proposal surfaces its parent (if any) and its forks (if any).

When the **original (root) proposal** is created, its author chooses how forks of it will be decided:

- **Independent mode** (the default): every proposal in the tree is voted on as its own separate yes / no / abstain decision. Any number of them can pass independently.
- **Competing mode** (planned for after the first launch): the original and all its forks form a single ranked group. Voters do not cast yes / no on each; they rank the alternatives (or choose "none of these"). One winner is computed via a ranked-choice method; the others are rejected.

Competing mode introduces a voting interaction (ranking a set of alternatives) that is distinct from the yes / no / abstain interaction used for an independent proposal.

### Voting

- For an independent proposal, a member casts one vote while voting is open: **yes**, **no**, or **abstain**.
- For a competing group of proposals (planned), the member instead ranks the alternatives (or chooses none).
- In either mode, the voter can change or retract their choice while voting is open.
- During voting, the running tally is visible.
- When the time is up, the proposal (or the competing group) closes automatically — a background process runs at the configured end-time — and the outcome is computed under the rule + quorum. Votes become immutable after close.

### Comments

- Any member can comment on any proposal — both while voting is open and after it has closed (discussion continues after the decision).
- Comments are written in markdown.
- The author can edit their own comment (an "edited" indicator persists afterwards).
- The author can delete their own comment; Owners, Admins, and Moderators can delete anyone's.
- Deleted comments do not vanish silently — their place in the discussion is preserved so the thread shape is honest.

### Interface preferences

- Choose interface theme: follow the device's setting, force light, or force dark.
- Choose interface language: English or Portuguese at launch.

---

## Future capabilities the design should accommodate

The design does not need to ship UI for these, but should not preclude them either. Listed in the rough order they're expected to land:

- **Inbox**: a cross-project surface that shows the things needing the member's attention — proposals closing soon, mentions, replies to their own comments, results of proposals they followed.
- **Push notifications**: web push (and possibly email) for inbox-worthy events. Configurable per project and per event type.
- **Comment threading**: replies to comments, forming a tree.
- **Reactions**: a small set of emoji on comments.
- **@mentions**: tag another member in a comment; triggers a notification.
- **More proposal types**:
  - **Document** — accepted text becomes a versioned canonical document (statutes, policies, bylaws). Amendments diff against earlier versions. Lives in a per-project document library.
  - **Election** — vote people into roles. Candidates self-nominate or are nominated.
  - **Poll** — pick one or more options from a co-created list.
  - **Petition** — gather support without binding decision.
- **Topics**: project-scoped folders that group proposals by area (e.g. "Finance", "Bylaws").
- **Chat**: per-project channels for fast informal conversation; supports text, image attachments, and voice notes.
- **Delegation**: a member can delegate their vote to another member (per project, per topic, or per proposal), with transitive delegation and any-time revocation.
- **Pseudonymous voting** as a per-project setting (tallies stay public; voter identity hidden).
- **Public, discoverable projects** in addition to the current private-only model.
- **Project templates** (Co-op, Sports Club, Residents' Association, etc.) that pre-fill defaults at creation.
- **Onboarding** for first-time signed-in users.
- **Settings** surfaces for both personal preferences and project-wide configuration.

---

## How the app is delivered

- A web application also installable as a Progressive Web App. Primary surface: phones (iOS 16+ and Android). It also runs on desktop browsers, but phones are the design target.
- One canonical hosted instance at `vozcoletiva.com`. Anyone can sign up; joining a specific group still requires an invitation from that group.
- Multilingual; ships with English and Portuguese; more languages will follow.

## Things the product is not

- Not a chat app or social network (chat is a side feature, not the centre of gravity).
- Not a project-management tool.
- Not gamified — no leaderboards, no streaks, no engagement scores. Anything that would distort governance by rewarding loud or frequent participation is out of scope.

## Constraints that aren't aesthetic

- **Accessibility**: WCAG 2.2 AA. Keyboard-navigable. Screen-reader compatible. Honour the user's preference for reduced motion.
- **Multilingual**: strings are externalised; the same screen must hold its shape with strings of varying length (Portuguese tends to run noticeably longer than English).
- **Open-source posture**: the code is publicly auditable; nothing surfaced in the UI should be incompatible with a member reading the source.
- **Non-interruptive**: the system speaks to the user only when it has something useful to say. Notifications and prompts are opt-in or strictly necessary.

## Existing brand

The brand identity — logo, colour palette, typography choices — exists and lives in the repository's `/brand/` directory (`palette.md`, `logo-mark.svg`, `logo-wordmark.svg`). The redesign should adopt this brand. If the design genuinely requires the brand to change, surface that as an explicit question rather than changing it silently.

---

## The ask

Design the user-facing app that delivers the features above. Cover at minimum every capability listed in *Features*. Anticipate the items in *Future capabilities* so the design accommodates them without being remade. Form factors at minimum: phone-portrait and a desktop browser.

What "the design" means is yours to define — flows, screens, components, interactions, motion, hierarchy, naming, density. Treat this brief as a specification of the system, not of the experience.
