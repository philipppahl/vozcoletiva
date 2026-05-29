/**
 * Seed a realistic three-project state with varied proposals, members, and
 * comments. Idempotent — calling `seed()` clears and re-fills.
 */

import {
  type Db,
  getDb,
  type MockProposal,
  type ProposalKind,
  resetDb,
  VOTE_ABSTAIN,
  VOTE_NONE,
  type VotingRule,
} from './db';

const HOUR = 3_600_000;
const DAY = 86_400_000;

export interface ScenarioConfig {
  /** Which seeded identity is signed in. */
  identityKey: 'marina' | 'pedro' | 'claudia' | 'newcomer';
  /** The moment, in ms, that the seed should consider "now" when laying out
   *  relative offsets. Defaults to wall-clock now. Scenarios shift this. */
  asOfMs?: number;
}

export function seed(config: ScenarioConfig = { identityKey: 'marina' }) {
  resetDb();
  const db = getDb();
  const asOf = config.asOfMs ?? Date.now();
  const isoFromOffset = (ms: number) => new Date(asOf + ms).toISOString();

  // ── users ──────────────────────────────────────────────────────────────
  const users = [
    { userId: 'u-marina', email: 'marina@example.com', displayName: 'Marina Costa' },
    { userId: 'u-pedro', email: 'pedro@example.com', displayName: 'Pedro Almeida' },
    { userId: 'u-claudia', email: 'claudia@example.com', displayName: 'Cláudia Reis' },
    { userId: 'u-bruno', email: 'bruno@example.com', displayName: 'Bruno Oliveira' },
    { userId: 'u-helena', email: 'helena@example.com', displayName: 'Helena Sá' },
    { userId: 'u-tiago', email: 'tiago@example.com', displayName: 'Tiago Mendes' },
    { userId: 'u-ines', email: 'ines@example.com', displayName: 'Inês Carvalho' },
    { userId: 'u-rui', email: 'rui@example.com', displayName: 'Rui Ferreira' },
    { userId: 'u-sofia', email: 'sofia@example.com', displayName: 'Sofia Pinto' },
    { userId: 'u-andre', email: 'andre@example.com', displayName: 'André Lopes' },
    { userId: 'u-newcomer', email: 'newcomer@example.com', displayName: 'New User' },
  ];
  for (const u of users) db.users.set(u.userId, u);

  // ── projects ───────────────────────────────────────────────────────────
  const projects = [
    {
      id: 'p-vmc',
      name: 'Vila Madalena Co-op',
      slug: 'vila-madalena',
      ownerId: 'u-marina',
      template: 'custom',
      visibility: 'private' as const,
      createdAt: isoFromOffset(-90 * DAY),
    },
    {
      id: 'p-fsbr',
      name: 'Software Livre BR',
      slug: 'softwarelivre-br',
      ownerId: 'u-pedro',
      template: 'custom',
      visibility: 'private' as const,
      createdAt: isoFromOffset(-180 * DAY),
    },
    {
      id: 'p-ndc',
      name: 'Núcleo de Dança Coletiva',
      slug: 'nucleo-danca',
      ownerId: 'u-claudia',
      template: 'custom',
      visibility: 'private' as const,
      createdAt: isoFromOffset(-30 * DAY),
    },
  ];
  for (const p of projects) db.projects.set(p.id, p);

  // ── categories ─────────────────────────────────────────────────────────
  // Every project starts with one "Commons" category. Owners can add more.
  for (const p of projects) {
    db.categories.set(`cat-${p.id}-commons`, {
      id: `cat-${p.id}-commons`,
      projectId: p.id,
      name: 'Commons',
      position: 0,
      createdAt: p.createdAt,
    });
  }

  // ── memberships ────────────────────────────────────────────────────────
  // Vila Madalena: most people are members; Marina owner, Pedro admin, Cláudia moderator
  const vmcMembers: Array<[string, Db['memberships'][number]['role']]> = [
    ['u-marina', 'owner'],
    ['u-pedro', 'admin'],
    ['u-claudia', 'moderator'],
    ['u-bruno', 'member'],
    ['u-helena', 'member'],
    ['u-tiago', 'member'],
    ['u-ines', 'member'],
    ['u-rui', 'member'],
    ['u-sofia', 'observer'],
    ['u-andre', 'observer'],
  ];
  for (const [userId, role] of vmcMembers) {
    db.memberships.push({
      projectId: 'p-vmc',
      userId,
      role,
      joinedAt: isoFromOffset(-89 * DAY),
    });
  }
  // Software Livre BR: smaller core, Marina is a regular member here
  db.memberships.push({
    projectId: 'p-fsbr',
    userId: 'u-pedro',
    role: 'owner',
    joinedAt: isoFromOffset(-179 * DAY),
  });
  db.memberships.push({
    projectId: 'p-fsbr',
    userId: 'u-marina',
    role: 'member',
    joinedAt: isoFromOffset(-150 * DAY),
  });
  db.memberships.push({
    projectId: 'p-fsbr',
    userId: 'u-helena',
    role: 'member',
    joinedAt: isoFromOffset(-150 * DAY),
  });
  db.memberships.push({
    projectId: 'p-fsbr',
    userId: 'u-tiago',
    role: 'admin',
    joinedAt: isoFromOffset(-160 * DAY),
  });
  // Núcleo de Dança: Marina is admin here
  db.memberships.push({
    projectId: 'p-ndc',
    userId: 'u-claudia',
    role: 'owner',
    joinedAt: isoFromOffset(-29 * DAY),
  });
  db.memberships.push({
    projectId: 'p-ndc',
    userId: 'u-marina',
    role: 'admin',
    joinedAt: isoFromOffset(-25 * DAY),
  });

  // ── invites ────────────────────────────────────────────────────────────
  db.invites.set('i-1', {
    id: 'i-1',
    projectId: 'p-vmc',
    code: 'K3X7PNQA',
    token: 'tok_K3X7PNQA',
    role: 'member',
    issuedBy: 'u-marina',
    issuedAt: isoFromOffset(-3 * DAY),
    expiresAt: isoFromOffset(11 * DAY),
    maxUses: 10,
    useCount: 0,
    note: 'For new tenants in June',
  });
  db.invites.set('i-2', {
    id: 'i-2',
    projectId: 'p-vmc',
    code: 'VMOBSERV',
    token: 'tok_VMOBSERV',
    role: 'observer',
    issuedBy: 'u-marina',
    issuedAt: isoFromOffset(-30 * DAY),
    expiresAt: null,
    maxUses: null,
    useCount: 3,
    note: 'Building committee guests',
  });

  // ── proposals ──────────────────────────────────────────────────────────
  //
  // Each proposal is a node in a deliberation tree. The ROOT carries the
  // voting rule, quorum, ends_at, proposal_kind and (when kind=document)
  // document_name. Alternatives (forks) inherit those.
  //
  // Seed shape:
  //  • Vila Madalena: 2 in-flight decision deliberations (one solo, one with
  //    2 alternatives), 1 in-flight Document deliberation (House Rules v2)
  //    with 3 alternatives, plus past closed proposals including 2 passed
  //    Document proposals (House Rules v1 + Co-op statutes v1).
  //  • Software Livre BR: 1 in-flight Document proposal (CoC v2), 1 past
  //    passed Document (CoC v1).
  //  • Núcleo de Dança: empty (no proposals).

  interface RootSeed {
    id: string;
    projectId: string;
    authorId: string;
    title: string;
    body: string;
    votingRule: VotingRule;
    quorum: number | null;
    status: MockProposal['status'];
    createdAt: string;
    endsAt: string;
    closedAt: string | null;
    proposalKind: ProposalKind;
    documentName?: string;
    alternatives?: Array<{
      id: string;
      authorId: string;
      title: string;
      body: string;
      createdAt: string;
    }>;
  }

  const roots: RootSeed[] = [
    // Decision: bicycle racks, with one alternative
    {
      id: 'pr-bike-racks',
      projectId: 'p-vmc',
      authorId: 'u-claudia',
      title: 'Replace bicycle storage racks in the garage',
      body: 'The existing racks date from 2014 and are corroded — three of them no longer hold a bike securely. Quotes from two local suppliers are attached.\n\nProposed expenditure: **R$ 4,800** from the maintenance reserve.\n\nWork would happen over a weekend in June.',
      votingRule: 'simple_majority',
      quorum: null,
      status: 'voting',
      createdAt: isoFromOffset(-3 * DAY),
      endsAt: isoFromOffset(2 * DAY),
      closedAt: null,
      proposalKind: 'decision',
      alternatives: [
        {
          id: 'pr-bike-refurb',
          authorId: 'u-helena',
          title: 'Refurbish the existing racks instead of replacing',
          body: 'Alternative: the racks can be sanded down, re-welded where needed, and repainted by Oficina Bonfim.\n\nQuote attached: **R$ 1,200** plus a Saturday of volunteer help. Saves ~75% over replacement and the same hardware would meet code.',
          createdAt: isoFromOffset(-2 * DAY - 4 * HOUR),
        },
      ],
    },
    // Decision: noise policy, solo, closes soon
    {
      id: 'pr-noise-policy',
      projectId: 'p-vmc',
      authorId: 'u-pedro',
      title: 'Adopt revised noise policy (2026 revision)',
      body: 'Quiet hours move from 22:00 → 21:30 on weekdays, with a stricter 60-day grace period for first violations.\n\nThis amends the by-laws and requires a two-thirds majority.',
      votingRule: 'two_thirds',
      quorum: 6,
      status: 'voting',
      createdAt: isoFromOffset(-6 * DAY - 20 * HOUR),
      endsAt: isoFromOffset(4 * HOUR),
      closedAt: null,
      proposalKind: 'decision',
    },
    // Decision: solar panels, 3 alternatives (formerly the "competing" tree)
    {
      id: 'pr-solar',
      projectId: 'p-vmc',
      authorId: 'u-bruno',
      title: 'Install solar panels on the roof',
      body: 'Energy audit completed in March suggests a 14-panel array would offset ~38% of common-area electricity. Financing options in the attached PDF.',
      votingRule: 'two_thirds',
      quorum: 7,
      status: 'voting',
      createdAt: isoFromOffset(-4 * DAY),
      endsAt: isoFromOffset(6 * DAY),
      closedAt: null,
      proposalKind: 'decision',
      alternatives: [
        {
          id: 'pr-solar-20',
          authorId: 'u-pedro',
          title: '20-panel array instead of 14',
          body: 'Larger array covers an estimated 54% of common-area electricity. Capex R$ 28,400, payback ~5.6 years.',
          createdAt: isoFromOffset(-3 * DAY - 6 * HOUR),
        },
        {
          id: 'pr-solar-lease',
          authorId: 'u-ines',
          title: 'Lease panels via EcoSolar (no upfront cost)',
          body: 'EcoSolar installs and maintains. Monthly fee: **R$ 480**. Estimated monthly saving on common-area bill: **R$ 720**. After 8 years we own the array outright.',
          createdAt: isoFromOffset(-2 * DAY),
        },
        {
          id: 'pr-solar-20-reserve',
          authorId: 'u-claudia',
          title: '20-panel array + maintenance reserve top-up',
          body: 'As the 20-panel alternative, plus **R$ 6,000** added to the maintenance reserve to cover inverter replacement in year 8.',
          createdAt: isoFromOffset(-1 * DAY - 2 * HOUR),
        },
      ],
    },
    // Decision: janitor (passed)
    {
      id: 'pr-janitor',
      projectId: 'p-vmc',
      authorId: 'u-claudia',
      title: 'Hire Limpa Sul as new janitorial service',
      body: 'After interviewing four providers, the building committee recommends Limpa Sul. Three-month trial, then renewable.',
      votingRule: 'simple_majority',
      quorum: null,
      status: 'passed',
      createdAt: isoFromOffset(-12 * DAY),
      endsAt: isoFromOffset(-5 * DAY),
      closedAt: isoFromOffset(-5 * DAY),
      proposalKind: 'decision',
    },
    // Decision: airbnb (rejected)
    {
      id: 'pr-airbnb',
      projectId: 'p-vmc',
      authorId: 'u-tiago',
      title: 'Allow short-term rentals (e.g. Airbnb)',
      body: 'Proposal to remove §7.4 restricting tenancies under 90 days.',
      votingRule: 'two_thirds',
      quorum: 7,
      status: 'rejected',
      createdAt: isoFromOffset(-40 * DAY),
      endsAt: isoFromOffset(-33 * DAY),
      closedAt: isoFromOffset(-33 * DAY),
      proposalKind: 'decision',
    },
    // Decision: withdrawn
    {
      id: 'pr-withdrawn',
      projectId: 'p-vmc',
      authorId: 'u-marina',
      title: 'Q1 budget approval (revised)',
      body: 'Withdrawn pending updated reserve numbers.',
      votingRule: 'simple_majority',
      quorum: null,
      status: 'withdrawn',
      createdAt: isoFromOffset(-20 * DAY),
      endsAt: isoFromOffset(-15 * DAY),
      closedAt: isoFromOffset(-18 * DAY),
      proposalKind: 'decision',
    },
    // Decision: quorum-failed
    {
      id: 'pr-quorum-fail',
      projectId: 'p-vmc',
      authorId: 'u-helena',
      title: 'Repaint the lobby (sage green)',
      body: 'Two coats of sage green, contractor available next month.',
      votingRule: 'simple_majority',
      quorum: 8,
      status: 'quorum_failed',
      createdAt: isoFromOffset(-25 * DAY),
      endsAt: isoFromOffset(-18 * DAY),
      closedAt: isoFromOffset(-18 * DAY),
      proposalKind: 'decision',
    },
    // Document: House Rules — passed v1 (founding) long ago
    {
      id: 'pr-house-rules-v1',
      projectId: 'p-vmc',
      authorId: 'u-marina',
      title: 'Adopt the House Rules (founding version)',
      body: '# House Rules\n\n**§1 Quiet hours.** Apartments observe quiet hours from 22:00 to 07:00 daily.\n\n**§2 Common spaces.** Common-area furniture is for shared use; do not remove items to private apartments.\n\n**§3 Bicycle storage.** Bikes belong in the racks in the garage; corridor storage is not permitted.\n\n**§4 Discretion.** The building committee may grant case-by-case exceptions in good faith.',
      votingRule: 'two_thirds',
      quorum: 6,
      status: 'passed',
      createdAt: isoFromOffset(-180 * DAY),
      endsAt: isoFromOffset(-173 * DAY),
      closedAt: isoFromOffset(-173 * DAY),
      proposalKind: 'document',
      documentName: 'House Rules',
    },
    // Document: House Rules v2 (the noise-policy amendment, now in voting)
    {
      id: 'pr-house-rules-v2',
      projectId: 'p-vmc',
      authorId: 'u-pedro',
      title: 'Amend §1: quiet hours start at 21:30 on weekdays',
      body: '# House Rules\n\n**§1 Quiet hours.** Apartments observe quiet hours from 21:30 to 07:00 on weekdays, and 22:00 to 07:00 on weekends. A 60-day grace period applies to first violations.\n\n**§2 Common spaces.** Common-area furniture is for shared use; do not remove items to private apartments.\n\n**§3 Bicycle storage.** Bikes belong in the racks in the garage; corridor storage is not permitted.\n\n**§4 Discretion.** The building committee may grant case-by-case exceptions in good faith.',
      votingRule: 'two_thirds',
      quorum: 6,
      status: 'voting',
      createdAt: isoFromOffset(-2 * DAY),
      endsAt: isoFromOffset(5 * DAY),
      closedAt: null,
      proposalKind: 'document',
      documentName: 'House Rules',
      alternatives: [
        {
          id: 'pr-house-rules-v2-alt',
          authorId: 'u-rui',
          title: 'Alternative: keep weekday quiet hours at 22:00, tighten weekends',
          body: '# House Rules\n\n**§1 Quiet hours.** Apartments observe quiet hours from 22:00 to 07:00 on weekdays, and 21:00 to 08:00 on weekends.\n\n**§2 Common spaces.** Common-area furniture is for shared use; do not remove items to private apartments.\n\n**§3 Bicycle storage.** Bikes belong in the racks in the garage; corridor storage is not permitted.\n\n**§4 Discretion.** The building committee may grant case-by-case exceptions in good faith.',
          createdAt: isoFromOffset(-1 * DAY - 3 * HOUR),
        },
      ],
    },
    // Document: Co-op statutes — passed v1 (founding)
    {
      id: 'pr-statutes-v1',
      projectId: 'p-vmc',
      authorId: 'u-marina',
      title: 'Adopt the Co-op statutes',
      body: '# Vila Madalena Co-operative — Statutes\n\n**Article 1.** Membership requires ownership or long-term tenancy of an apartment in the building.\n\n**Article 2.** The Owner role is held by one member at a time, elected for renewable two-year terms.\n\n**Article 3.** Decisions binding on the co-op are made via the deliberation platform and recorded in the audit log.',
      votingRule: 'two_thirds',
      quorum: 7,
      status: 'passed',
      createdAt: isoFromOffset(-200 * DAY),
      endsAt: isoFromOffset(-190 * DAY),
      closedAt: isoFromOffset(-190 * DAY),
      proposalKind: 'document',
      documentName: 'Co-op statutes',
    },
    // Software Livre BR — Document: Code of Conduct v1 (passed) + v2 (voting)
    {
      id: 'pr-coc-v1',
      projectId: 'p-fsbr',
      authorId: 'u-pedro',
      title: 'Adopt the Code of Conduct (Contributor Covenant 2.0)',
      body: '# Software Livre BR — Code of Conduct\n\n## Our pledge\n\nWe pledge to make participation in our project a harassment-free experience for everyone.\n\n## Enforcement\n\nReports may be filed with the conduct committee at coc@example.com.',
      votingRule: 'simple_majority',
      quorum: null,
      status: 'passed',
      createdAt: isoFromOffset(-120 * DAY),
      endsAt: isoFromOffset(-113 * DAY),
      closedAt: isoFromOffset(-113 * DAY),
      proposalKind: 'document',
      documentName: 'Code of Conduct',
    },
    {
      id: 'pr-coc-v2',
      projectId: 'p-fsbr',
      authorId: 'u-tiago',
      title: 'Upgrade Code of Conduct to Covenant 2.1',
      body: '# Software Livre BR — Code of Conduct\n\n## Our pledge\n\nWe pledge to make participation in our project a harassment-free experience for everyone, regardless of background or identity.\n\n## Enforcement\n\nReports may be filed with the conduct committee at coc@example.com. The committee responds within 48 hours and may take any action it deems necessary — from a private warning to permanent exclusion.\n\n## Scope\n\nThis code applies to all project spaces and to any space where someone represents the project.',
      votingRule: 'simple_majority',
      quorum: null,
      status: 'voting',
      createdAt: isoFromOffset(-2 * DAY),
      endsAt: isoFromOffset(5 * DAY),
      closedAt: null,
      proposalKind: 'document',
      documentName: 'Code of Conduct',
    },
  ];

  // Flatten roots + alternatives into per-proposal rows. Every proposal is
  // back-filled with the project's "Commons" category.
  for (const root of roots) {
    const categoryId = `cat-${root.projectId}-commons`;
    const rootProposal: MockProposal = {
      id: root.id,
      projectId: root.projectId,
      authorId: root.authorId,
      title: root.title,
      body: root.body,
      votingRule: root.votingRule,
      quorum: root.quorum,
      status: root.status,
      createdAt: root.createdAt,
      endsAt: root.endsAt,
      closedAt: root.closedAt,
      parentId: null,
      rootId: root.id,
      proposalKind: root.proposalKind,
      documentName: root.documentName ?? null,
      categoryId,
    };
    db.proposals.set(root.id, rootProposal);
    for (const alt of root.alternatives ?? []) {
      const altProposal: MockProposal = {
        id: alt.id,
        projectId: root.projectId,
        authorId: alt.authorId,
        title: alt.title,
        body: alt.body,
        votingRule: root.votingRule,
        quorum: root.quorum,
        status: root.status,
        createdAt: alt.createdAt,
        endsAt: root.endsAt,
        closedAt: root.closedAt,
        parentId: root.id,
        rootId: root.id,
        proposalKind: root.proposalKind,
        documentName: root.documentName ?? null,
        categoryId,
      };
      db.proposals.set(alt.id, altProposal);
    }
  }

  // ── votes ──────────────────────────────────────────────────────────────
  //
  // Votes are per-deliberation: rootId + userId + choice. `choice` is the
  // picked alternative's proposal id, VOTE_NONE, or VOTE_ABSTAIN. For solo
  // proposals (no alternatives) picking the root's id = "yes / pass" and
  // picking VOTE_NONE = "no / don't pass".
  const votes: Array<[string, string, string]> = [
    // bike racks — root has 2 alternatives. Mostly favour the original.
    ['pr-bike-racks', 'u-pedro', 'pr-bike-racks'],
    ['pr-bike-racks', 'u-claudia', 'pr-bike-racks'],
    ['pr-bike-racks', 'u-bruno', 'pr-bike-racks'],
    ['pr-bike-racks', 'u-tiago', 'pr-bike-refurb'],
    ['pr-bike-racks', 'u-ines', 'pr-bike-racks'],
    ['pr-bike-racks', 'u-rui', 'pr-bike-refurb'],
    ['pr-bike-racks', 'u-helena', 'pr-bike-refurb'],
    ['pr-bike-racks', 'u-sofia', 'pr-bike-racks'],
    ['pr-bike-racks', 'u-marina', VOTE_ABSTAIN],
    // noise policy (solo, two-thirds) — 8 yes, 2 none-of-these
    ['pr-noise-policy', 'u-marina', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-pedro', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-claudia', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-bruno', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-tiago', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-ines', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-sofia', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-andre', 'pr-noise-policy'],
    ['pr-noise-policy', 'u-helena', VOTE_NONE],
    ['pr-noise-policy', 'u-rui', VOTE_NONE],
    // solar — 4 alternatives. Lease leading, then 20-panel, then root, then reserve.
    ['pr-solar', 'u-pedro', 'pr-solar-20'],
    ['pr-solar', 'u-bruno', 'pr-solar'],
    ['pr-solar', 'u-tiago', 'pr-solar-lease'],
    ['pr-solar', 'u-ines', 'pr-solar-lease'],
    ['pr-solar', 'u-sofia', 'pr-solar-lease'],
    ['pr-solar', 'u-andre', 'pr-solar-lease'],
    ['pr-solar', 'u-helena', 'pr-solar-20'],
    ['pr-solar', 'u-rui', 'pr-solar-20'],
    ['pr-solar', 'u-claudia', 'pr-solar-20-reserve'],
    ['pr-solar', 'u-marina', VOTE_ABSTAIN],
    // janitor — closed, passed long ago
    ['pr-janitor', 'u-marina', 'pr-janitor'],
    ['pr-janitor', 'u-pedro', 'pr-janitor'],
    ['pr-janitor', 'u-claudia', 'pr-janitor'],
    ['pr-janitor', 'u-bruno', 'pr-janitor'],
    ['pr-janitor', 'u-helena', 'pr-janitor'],
    ['pr-janitor', 'u-tiago', 'pr-janitor'],
    ['pr-janitor', 'u-ines', 'pr-janitor'],
    ['pr-janitor', 'u-sofia', 'pr-janitor'],
    ['pr-janitor', 'u-rui', VOTE_NONE],
    ['pr-janitor', 'u-andre', VOTE_ABSTAIN],
    // airbnb — closed, rejected
    ['pr-airbnb', 'u-tiago', 'pr-airbnb'],
    ['pr-airbnb', 'u-ines', 'pr-airbnb'],
    ['pr-airbnb', 'u-marina', VOTE_NONE],
    ['pr-airbnb', 'u-pedro', VOTE_NONE],
    ['pr-airbnb', 'u-claudia', VOTE_NONE],
    ['pr-airbnb', 'u-bruno', VOTE_NONE],
    ['pr-airbnb', 'u-helena', VOTE_NONE],
    ['pr-airbnb', 'u-rui', VOTE_NONE],
    ['pr-airbnb', 'u-sofia', VOTE_NONE],
    ['pr-airbnb', 'u-andre', VOTE_NONE],
    // quorum-fail — only 4 voted, quorum=8
    ['pr-quorum-fail', 'u-helena', 'pr-quorum-fail'],
    ['pr-quorum-fail', 'u-rui', 'pr-quorum-fail'],
    ['pr-quorum-fail', 'u-sofia', VOTE_NONE],
    ['pr-quorum-fail', 'u-andre', VOTE_ABSTAIN],
    // House Rules v1 (founding) — passed long ago, very strong support
    ['pr-house-rules-v1', 'u-marina', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-pedro', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-claudia', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-bruno', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-helena', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-tiago', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-ines', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-sofia', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-rui', 'pr-house-rules-v1'],
    ['pr-house-rules-v1', 'u-andre', VOTE_ABSTAIN],
    // House Rules v2 (in-flight) — 2 alts, lots of opinions
    ['pr-house-rules-v2', 'u-pedro', 'pr-house-rules-v2'],
    ['pr-house-rules-v2', 'u-marina', 'pr-house-rules-v2'],
    ['pr-house-rules-v2', 'u-claudia', 'pr-house-rules-v2'],
    ['pr-house-rules-v2', 'u-tiago', 'pr-house-rules-v2-alt'],
    ['pr-house-rules-v2', 'u-ines', 'pr-house-rules-v2-alt'],
    ['pr-house-rules-v2', 'u-helena', VOTE_NONE],
    ['pr-house-rules-v2', 'u-bruno', VOTE_ABSTAIN],
    // Co-op statutes v1
    ['pr-statutes-v1', 'u-marina', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-pedro', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-claudia', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-bruno', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-helena', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-tiago', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-ines', 'pr-statutes-v1'],
    ['pr-statutes-v1', 'u-sofia', VOTE_NONE],
    // CoC v1 (FSBR) — passed
    ['pr-coc-v1', 'u-pedro', 'pr-coc-v1'],
    ['pr-coc-v1', 'u-marina', 'pr-coc-v1'],
    ['pr-coc-v1', 'u-helena', 'pr-coc-v1'],
    ['pr-coc-v1', 'u-tiago', 'pr-coc-v1'],
    // CoC v2 (FSBR) — voting
    ['pr-coc-v2', 'u-pedro', 'pr-coc-v2'],
    ['pr-coc-v2', 'u-tiago', 'pr-coc-v2'],
    ['pr-coc-v2', 'u-helena', VOTE_ABSTAIN],
  ];
  for (const [rootId, userId, choice] of votes) {
    db.votes.push({ rootId, userId, choice, at: isoFromOffset(-1 * DAY) });
  }

  // ── comments ───────────────────────────────────────────────────────────
  const comments = [
    {
      id: 'c-1',
      proposalId: 'pr-bike-racks',
      authorId: 'u-helena',
      body: 'Could we get a third quote? The two attached are both from the same neighbourhood.',
      createdAt: isoFromOffset(-2 * DAY - 3 * HOUR),
    },
    {
      id: 'c-2',
      proposalId: 'pr-bike-racks',
      authorId: 'u-claudia',
      body: 'Happy to ask Bicicletaria Pinheiros for a third quote. Will post here by Wednesday.',
      createdAt: isoFromOffset(-2 * DAY - 1 * HOUR),
      editedAt: isoFromOffset(-2 * DAY - 0.5 * HOUR),
    },
    {
      id: 'c-3',
      proposalId: 'pr-bike-racks',
      authorId: 'u-ines',
      body: 'Thanks for organising this — overdue.',
      createdAt: isoFromOffset(-20 * HOUR),
    },
    {
      id: 'c-4',
      proposalId: 'pr-noise-policy',
      authorId: 'u-rui',
      body: 'I worry about families with small kids — they need flexibility. Could we carve out an exception?',
      createdAt: isoFromOffset(-5 * DAY),
    },
    {
      id: 'c-5',
      proposalId: 'pr-noise-policy',
      authorId: 'u-pedro',
      body: '@u-rui the by-law already allows building-management discretion in good faith — see §4.2.',
      createdAt: isoFromOffset(-4 * DAY - 8 * HOUR),
    },
    {
      id: 'c-6',
      proposalId: 'pr-solar',
      authorId: 'u-claudia',
      body: 'The capex is significant. I want to see this paired with a maintenance reserve update.',
      createdAt: isoFromOffset(-3 * DAY),
    },
    {
      id: 'c-deleted',
      proposalId: 'pr-solar',
      authorId: 'u-tiago',
      body: null,
      createdAt: isoFromOffset(-2 * DAY - 12 * HOUR),
      deletedAt: isoFromOffset(-2 * DAY),
      deletedBy: 'u-claudia',
    },
    {
      id: 'c-refurb-1',
      proposalId: 'pr-bike-refurb',
      authorId: 'u-claudia',
      body: 'Worth considering. Can the welds hold the e-bikes (heavier)?',
      createdAt: isoFromOffset(-2 * DAY - 2 * HOUR),
    },
    {
      id: 'c-solar-lease',
      proposalId: 'pr-solar-lease',
      authorId: 'u-claudia',
      body: 'Read the lease terms carefully — what happens if EcoSolar folds in year 4?',
      createdAt: isoFromOffset(-1 * DAY - 8 * HOUR),
    },
  ];
  for (const c of comments) {
    db.comments.set(c.id, {
      id: c.id,
      proposalId: c.proposalId,
      authorId: c.authorId,
      body: c.body,
      createdAt: c.createdAt,
      editedAt: c.editedAt ?? null,
      deletedAt: c.deletedAt ?? null,
      deletedBy: c.deletedBy ?? null,
    });
  }

  // ── conversations + messages (channels, DMs, one thread) ───────────────
  seedConversations(asOf);

  // ── inbox (M5) ─────────────────────────────────────────────────────────
  // Seeded items target Marina. Mix of read + unread + kinds.
  db.inboxItems.push(
    {
      id: 'ix-seed-1',
      userId: 'u-marina',
      kind: 'mention',
      projectId: 'p-vmc',
      actorId: 'u-pedro',
      conversationId: 'ch-vmc-general',
      messageId: 'm-g-4',
      preview: 'Same — and @Marina Costa could you share the deck beforehand?',
      createdAt: isoFromOffset(-26 * HOUR),
      readAt: null,
    },
    {
      id: 'ix-seed-2',
      userId: 'u-marina',
      kind: 'reply',
      projectId: 'p-vmc',
      actorId: 'u-helena',
      conversationId: 'ch-vmc-bikes',
      messageId: 'm-b-4',
      preview: 'great',
      createdAt: isoFromOffset(-32 * HOUR),
      readAt: null,
    },
    {
      id: 'ix-seed-3',
      userId: 'u-marina',
      kind: 'comment-on-yours',
      projectId: 'p-vmc',
      actorId: 'u-rui',
      proposalId: 'pr-withdrawn',
      commentId: 'c-withdrawn-1',
      preview: 'Makes sense to wait for the updated reserve report.',
      createdAt: isoFromOffset(-2 * DAY),
      readAt: isoFromOffset(-1 * DAY),
    },
    {
      id: 'ix-seed-4',
      userId: 'u-marina',
      kind: 'proposal-closed',
      projectId: 'p-vmc',
      actorId: 'system',
      proposalId: 'pr-janitor',
      preview:
        'Hire Limpa Sul as new janitorial service → Hire Limpa Sul as new janitorial service',
      createdAt: isoFromOffset(-5 * DAY),
      readAt: isoFromOffset(-5 * DAY),
    },
    {
      id: 'ix-seed-5',
      userId: 'u-marina',
      kind: 'document-amended',
      projectId: 'p-vmc',
      actorId: 'system',
      documentName: 'House Rules',
      proposalId: 'pr-house-rules-v1',
      preview: 'House Rules — new version',
      createdAt: isoFromOffset(-173 * DAY),
      readAt: isoFromOffset(-173 * DAY),
    },
    {
      id: 'ix-seed-6',
      userId: 'u-marina',
      kind: 'mention',
      projectId: 'p-fsbr',
      actorId: 'u-tiago',
      conversationId: 'ch-fsbr-coc',
      messageId: 'm-fsbr-coc-1',
      preview: 'Drafted a v2 — @Marina Costa would value your review.',
      createdAt: isoFromOffset(-6 * HOUR),
      readAt: null,
    },
  );

  // ── current user (per scenario) ─────────────────────────────────────────
  const identityMap: Record<ScenarioConfig['identityKey'], string | null> = {
    marina: 'u-marina',
    pedro: 'u-pedro',
    claudia: 'u-claudia',
    newcomer: 'u-newcomer',
  };
  db.currentUserId = identityMap[config.identityKey];
}

// ── conversations + messages ───────────────────────────────────────────────
//
// Six placeholder image attachments rendered as tiny inline-gradient SVG data
// URIs — keeps the seed self-contained without hitting the network.
const GRADIENTS: string[] = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="%23A78BFA"/><stop offset="100%" stop-color="%235B5BE0"/></linearGradient></defs><rect width="320" height="180" fill="url(%23g)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FBBF24"/><stop offset="100%" stop-color="%23EC4899"/></linearGradient></defs><rect width="320" height="180" fill="url(%23g)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0%" stop-color="%2334D399"/><stop offset="100%" stop-color="%23059669"/></linearGradient></defs><rect width="320" height="180" fill="url(%23g)"/></svg>',
];

interface SeedMessageInput {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  offsetMs: number; // ms from asOf
  parentMessageId?: string | null;
  attachmentKind?: 'image' | 'voice';
  attachmentMeta?: { url?: string; durationMs?: number; width?: number; height?: number };
}

function seedConversations(asOf: number) {
  const db = getDb();
  const iso = (ms: number) => new Date(asOf + ms).toISOString();

  // ── channels ─────────────────────────────────────────────────────────────
  const channels: Array<{
    id: string;
    projectId: string;
    name: string;
    description?: string;
  }> = [
    {
      id: 'ch-vmc-general',
      projectId: 'p-vmc',
      name: 'general',
      description: 'Building-wide chatter',
    },
    {
      id: 'ch-vmc-bikes',
      projectId: 'p-vmc',
      name: 'bicicletas',
      description: 'Bike room, racks, e-bikes',
    },
    {
      id: 'ch-vmc-maint',
      projectId: 'p-vmc',
      name: 'manutenção',
      description: 'Maintenance updates',
    },
    { id: 'ch-fsbr-general', projectId: 'p-fsbr', name: 'general', description: 'All things SLBR' },
    {
      id: 'ch-fsbr-coc',
      projectId: 'p-fsbr',
      name: 'coc-revision',
      description: 'Working on the new CoC',
    },
    { id: 'ch-ndc-general', projectId: 'p-ndc', name: 'general' },
  ];
  for (const c of channels) {
    db.conversations.set(c.id, {
      id: c.id,
      kind: 'channel',
      projectId: c.projectId,
      name: c.name,
      description: c.description ?? null,
      createdAt: iso(-60 * DAY),
    });
  }

  // ── DMs (cross-project; participantIds always sorted) ────────────────────
  const dms: Array<{ id: string; a: string; b: string }> = [
    { id: 'dm-marina-pedro', a: 'u-marina', b: 'u-pedro' },
    { id: 'dm-marina-claudia', a: 'u-marina', b: 'u-claudia' },
  ];
  for (const d of dms) {
    const [lo, hi] = d.a < d.b ? [d.a, d.b] : [d.b, d.a];
    db.conversations.set(d.id, {
      id: d.id,
      kind: 'dm',
      participantIds: [lo, hi],
      createdAt: iso(-30 * DAY),
    });
  }

  // ── messages ─────────────────────────────────────────────────────────────
  const messages: SeedMessageInput[] = [
    // #general (Vila Madalena)
    {
      id: 'm-g-1',
      conversationId: 'ch-vmc-general',
      authorId: 'u-pedro',
      body: 'Bom dia everyone — quick reminder the bike-rack vote closes Friday.',
      offsetMs: -2 * DAY - 4 * HOUR,
    },
    {
      id: 'm-g-2',
      conversationId: 'ch-vmc-general',
      authorId: 'u-helena',
      body: 'thanks 👍',
      offsetMs: -2 * DAY - 3 * HOUR,
    },
    {
      id: 'm-g-3',
      conversationId: 'ch-vmc-general',
      authorId: 'u-bruno',
      body: 'Solar quote update: meeting Eduardo from EcoSolar on Thursday at 18:00 in the lobby. Open to anyone who wants to come.',
      offsetMs: -1 * DAY - 6 * HOUR,
    },
    {
      id: 'm-g-4',
      conversationId: 'ch-vmc-general',
      authorId: 'u-claudia',
      body: "I'll be there.",
      offsetMs: -1 * DAY - 5 * HOUR + 30 * MINUTE,
    },
    {
      id: 'm-g-5',
      conversationId: 'ch-vmc-general',
      authorId: 'u-marina',
      body: 'Same — and **@u-bruno** could you share the deck beforehand?',
      offsetMs: -1 * DAY - 5 * HOUR,
    },
    {
      id: 'm-g-6',
      conversationId: 'ch-vmc-general',
      authorId: 'u-bruno',
      body: 'Will do, by tomorrow morning.',
      offsetMs: -1 * DAY - 4 * HOUR,
    },
    {
      id: 'm-g-7',
      conversationId: 'ch-vmc-general',
      authorId: 'u-tiago',
      body: 'A photo of the corroded racks for context:',
      offsetMs: -8 * HOUR,
      attachmentKind: 'image',
      attachmentMeta: { url: GRADIENTS[0]!, width: 320, height: 180 },
    },
    {
      id: 'm-g-8',
      conversationId: 'ch-vmc-general',
      authorId: 'u-helena',
      body: 'oof, yeah those are gone',
      offsetMs: -7 * HOUR + 50 * MINUTE,
    },
    {
      id: 'm-g-9',
      conversationId: 'ch-vmc-general',
      authorId: 'u-rui',
      body: 'Voice note 🎤',
      offsetMs: -2 * HOUR,
      attachmentKind: 'voice',
      attachmentMeta: { durationMs: 18_000 },
    },

    // #bicicletas (Vila Madalena) — has a threaded message
    {
      id: 'm-b-1',
      conversationId: 'ch-vmc-bikes',
      authorId: 'u-claudia',
      body: "Putting up the third quote tomorrow morning. It's from Bicicletaria Pinheiros.",
      offsetMs: -1 * DAY - 3 * HOUR,
    },
    {
      id: 'm-b-2',
      conversationId: 'ch-vmc-bikes',
      authorId: 'u-pedro',
      body: 'Are they covering installation? The other two quotes did.',
      offsetMs: -1 * DAY - 2 * HOUR + 40 * MINUTE,
      parentMessageId: 'm-b-1',
    },
    {
      id: 'm-b-3',
      conversationId: 'ch-vmc-bikes',
      authorId: 'u-claudia',
      body: 'Yes, included. Same as the others.',
      offsetMs: -1 * DAY - 2 * HOUR + 15 * MINUTE,
      parentMessageId: 'm-b-1',
    },
    {
      id: 'm-b-4',
      conversationId: 'ch-vmc-bikes',
      authorId: 'u-helena',
      body: 'great',
      offsetMs: -1 * DAY - 1 * HOUR,
      parentMessageId: 'm-b-1',
    },
    {
      id: 'm-b-5',
      conversationId: 'ch-vmc-bikes',
      authorId: 'u-tiago',
      body: 'Side note — anyone interested in a bike-maintenance Saturday workshop next month?',
      offsetMs: -6 * HOUR,
    },

    // #manutenção (Vila Madalena) — quieter
    {
      id: 'm-m-1',
      conversationId: 'ch-vmc-maint',
      authorId: 'u-claudia',
      body: 'Limpa Sul starts Monday. New schedule attached to the building announcements board.',
      offsetMs: -3 * DAY,
    },
    {
      id: 'm-m-2',
      conversationId: 'ch-vmc-maint',
      authorId: 'u-pedro',
      body: 'Thanks for sorting that 🙏',
      offsetMs: -2 * DAY - 22 * HOUR,
    },

    // #general (Software Livre BR)
    {
      id: 'm-fsbr-1',
      conversationId: 'ch-fsbr-general',
      authorId: 'u-pedro',
      body: 'CoC v2.1 draft is up. PRs welcome.',
      offsetMs: -2 * DAY,
    },
    {
      id: 'm-fsbr-2',
      conversationId: 'ch-fsbr-general',
      authorId: 'u-tiago',
      body: 'Reading now.',
      offsetMs: -1 * DAY - 18 * HOUR,
    },

    // #coc-revision (Software Livre BR)
    {
      id: 'm-fsbr-coc-1',
      conversationId: 'ch-fsbr-coc',
      authorId: 'u-tiago',
      body: 'Two suggestions in the §3 enforcement section. Will open a PR by EOD.',
      offsetMs: -1 * DAY,
    },

    // #general (Núcleo de Dança)
    {
      id: 'm-ndc-1',
      conversationId: 'ch-ndc-general',
      authorId: 'u-claudia',
      body: 'Studio is booked next Tuesday 19:00–21:00. See you all there.',
      offsetMs: -4 * DAY,
    },

    // DMs
    {
      id: 'm-dm-mp-1',
      conversationId: 'dm-marina-pedro',
      authorId: 'u-pedro',
      body: 'Quick one — did you see the EcoSolar deck?',
      offsetMs: -1 * DAY - 8 * HOUR,
    },
    {
      id: 'm-dm-mp-2',
      conversationId: 'dm-marina-pedro',
      authorId: 'u-marina',
      body: 'Not yet, will look tonight.',
      offsetMs: -1 * DAY - 7 * HOUR,
    },
    {
      id: 'm-dm-mp-3',
      conversationId: 'dm-marina-pedro',
      authorId: 'u-pedro',
      body: '👍',
      offsetMs: -1 * DAY - 6 * HOUR + 50 * MINUTE,
    },
    {
      id: 'm-dm-mp-4',
      conversationId: 'dm-marina-pedro',
      authorId: 'u-pedro',
      body: 'Forwarded the slides separately. Worth a skim before Thursday.',
      offsetMs: -30 * MINUTE,
    },

    {
      id: 'm-dm-mc-1',
      conversationId: 'dm-marina-claudia',
      authorId: 'u-claudia',
      body: 'Welcome to the dance collective! Anything you want to discuss before the first practice?',
      offsetMs: -10 * DAY,
    },
    {
      id: 'm-dm-mc-2',
      conversationId: 'dm-marina-claudia',
      authorId: 'u-marina',
      body: 'Thanks! All good — see you Tuesday.',
      offsetMs: -10 * DAY + 1 * HOUR,
    },
  ];

  for (const m of messages) {
    db.messages.set(m.id, {
      id: m.id,
      conversationId: m.conversationId,
      parentMessageId: m.parentMessageId ?? null,
      authorId: m.authorId,
      body: m.body,
      attachments: m.attachmentKind
        ? [
            {
              kind: m.attachmentKind,
              url: m.attachmentMeta?.url ?? '',
              ...(m.attachmentMeta?.width && { width: m.attachmentMeta.width }),
              ...(m.attachmentMeta?.height && { height: m.attachmentMeta.height }),
              ...(m.attachmentMeta?.durationMs && { durationMs: m.attachmentMeta.durationMs }),
            },
          ]
        : [],
      createdAt: iso(m.offsetMs),
      editedAt: null,
    });
  }

  // ── conversation reads for the seeded "you" identity ────────────────────
  // Marina has read most of #general up to m-g-6 (so m-g-7/8/9 are unread).
  // She's read everything in #bicicletas and #manutenção. DMs: Pedro is unread
  // at m-dm-mp-4; Claudia is fully read.
  const reads: Array<[string, string]> = [
    ['ch-vmc-general', 'm-g-6'],
    ['ch-vmc-bikes', 'm-b-5'],
    ['ch-vmc-maint', 'm-m-2'],
    ['ch-fsbr-general', 'm-fsbr-1'], // m-fsbr-2 unread for marina
    ['ch-fsbr-coc', 'm-fsbr-coc-1'],
    ['ch-ndc-general', 'm-ndc-1'],
    ['dm-marina-pedro', 'm-dm-mp-3'], // m-dm-mp-4 unread
    ['dm-marina-claudia', 'm-dm-mc-2'],
  ];
  for (const [convId, msgId] of reads) {
    db.conversationReads.push({
      conversationId: convId,
      userId: 'u-marina',
      lastReadMessageId: msgId,
      at: iso(-1 * HOUR),
    });
  }
}

const MINUTE = 60_000;
