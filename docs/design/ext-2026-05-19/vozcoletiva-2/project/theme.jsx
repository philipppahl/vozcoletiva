// theme.jsx — design tokens, i18n strings, sample data
// All theme values are derived from the active tweak set (light/dark, accent,
// density, language). Tokens use oklch so light/dark stay harmonised.

// ── palettes ───────────────────────────────────────────────────────────────
// Neutrals sit on a cool slate hue (h≈240) at very low chroma so the page
// feels modern and contemporary rather than warm/earthy. All accents share
// chroma (0.16) and orbit the wheel evenly; states share theirs.
const VOZ_PALETTES = {
  light: {
    bg:        'oklch(0.978 0.004 240)',  // cool off-white
    surface:   'oklch(1.0 0 0)',          // pure white card
    surface2:  'oklch(0.955 0.005 240)',
    ink:       'oklch(0.21 0.012 250)',
    inkSoft:   'oklch(0.46 0.015 250)',
    inkMute:   'oklch(0.62 0.014 250)',
    border:    'oklch(0.92 0.006 240)',
    borderHi:  'oklch(0.82 0.010 240)',
    fieldBg:   'oklch(0.962 0.005 240)',
    yes:       'oklch(0.52 0.15 155)',
    no:        'oklch(0.55 0.20 25)',
    abstain:   'oklch(0.58 0.010 250)',
    warn:      'oklch(0.66 0.16 75)',
    shadow:    '0 1px 2px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.06)',
    shadowLg:  '0 4px 12px rgba(15,23,42,0.07), 0 18px 40px rgba(15,23,42,0.10)',
    shadowSm:  '0 1px 2px rgba(15,23,42,0.07)',
  },
  dark: {
    bg:        'oklch(0.165 0.012 250)',
    surface:   'oklch(0.205 0.012 250)',
    surface2:  'oklch(0.185 0.012 250)',
    ink:       'oklch(0.965 0.005 240)',
    inkSoft:   'oklch(0.74 0.010 240)',
    inkMute:   'oklch(0.56 0.010 240)',
    border:    'oklch(0.29 0.012 250)',
    borderHi:  'oklch(0.42 0.014 250)',
    fieldBg:   'oklch(0.225 0.012 250)',
    yes:       'oklch(0.74 0.15 155)',
    no:        'oklch(0.74 0.18 25)',
    abstain:   'oklch(0.70 0.010 240)',
    warn:      'oklch(0.78 0.15 75)',
    shadow:    '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
    shadowLg:  '0 4px 12px rgba(0,0,0,0.4), 0 22px 50px rgba(0,0,0,0.5)',
    shadowSm:  '0 1px 2px rgba(0,0,0,0.5)',
  },
};

// Modern accent set — vibrant, evenly spaced around the wheel, all sharing
// chroma so they read as a family. Indigo is the default (sleek + civic).
const VOZ_ACCENTS = {
  indigo: { h: 265, c: 0.16, label: 'Indigo' },
  violet: { h: 305, c: 0.16, label: 'Violet' },
  teal:   { h: 195, c: 0.13, label: 'Teal' },
  amber:  { h: 70,  c: 0.16, label: 'Amber' },
};

function vozTheme(dark, accentKey) {
  const p = dark ? VOZ_PALETTES.dark : VOZ_PALETTES.light;
  const a = VOZ_ACCENTS[accentKey] || VOZ_ACCENTS.indigo;
  const L = dark ? 0.72 : 0.55;
  const softL = dark ? 0.28 : 0.94;
  const softC = a.c * 0.3;
  return {
    ...p,
    accent:        `oklch(${L} ${a.c} ${a.h})`,
    accentSoft:    `oklch(${softL} ${softC} ${a.h})`,
    accentInk:     dark ? p.bg : '#fdfcfa',
    name: a.label,
  };
}

// ── density ─────────────────────────────────────────────────────────────────
const VOZ_DENSITY = {
  compact:  { pad: 10, gap: 8,  row: 44, line: 1.4, fs: 14 },
  regular:  { pad: 14, gap: 12, row: 52, line: 1.55, fs: 15 },
  comfy:    { pad: 18, gap: 16, row: 60, line: 1.7,  fs: 16 },
};

// ── i18n strings (en / pt-BR) ───────────────────────────────────────────────
const VOZ_STR = {
  en: {
    appName: 'vozcoletiva',
    tagline: 'collective decisions, kept in the open',
    // tabs
    tab_proposals: 'Proposals', tab_members: 'Members',
    tab_invite: 'Invite', tab_you: 'You',
    tab_documents: 'Documents', tab_messages: 'Messages',
    tab_search: 'Search',
    // auth
    signIn: 'Sign in', signUp: 'Create an account',
    email: 'Email', password: 'Password', displayName: 'Display name',
    verify_title: 'Check your email',
    verify_sub: 'We sent a 6-digit code to',
    verify_cta: 'Verify',
    auth_or: 'or',
    have_account: 'Already have an account? Sign in',
    no_account: "Don't have an account yet? Create one",
    // projects
    your_projects: 'Your projects',
    new_project: 'New project', join_project: 'Join with code',
    // project home
    proposals: 'Proposals',
    filter_open: 'Voting', filter_passed: 'Passed',
    filter_rejected: 'Rejected', filter_all: 'All',
    new_proposal: 'New proposal',
    closes_in: 'closes in', closed: 'closed',
    rule_majority: 'simple majority', rule_supermajority: 'two-thirds',
    quorum: 'quorum', votes: 'votes',
    // states
    state_voting: 'Voting', state_passed: 'Passed', state_rejected: 'Rejected',
    state_quorum: 'Quorum failed', state_withdrawn: 'Withdrawn',
    // detail / voting
    your_vote: 'Your vote', yes: 'Yes', no: 'No', abstain: 'Abstain',
    change_vote: 'Change vote', retract: 'Retract',
    running_tally: 'Running tally', final_tally: 'Final result',
    rule: 'Rule', closes: 'Closes',
    voted: 'voted', not_voted: 'not voted',
    discussion: 'Discussion',
    write_comment: 'Write a comment…',
    edited: 'edited', deleted: '[comment deleted]',
    withdraw: 'Withdraw proposal',
    // forks (user-facing language: "alternative")
    fork: 'Alternative', fork_verb: 'Propose an alternative',
    fork_of: 'Alternative to',
    variants: 'Alternatives', variants_in_tree: 'alternatives',
    root_label: 'Original',
    decision_header: 'Decision',
    deliberation_header: 'Open question',
    rank_to_decide: 'Rank to decide',
    voted_on_this: 'voted on this alternative',
    ranked_so_far: 'ranked so far',
    switch_alt: 'Other alternatives',
    add_alt: 'Add an alternative',
    fork_mode: 'Decision mode',
    fork_mode_independent: 'Independent',
    fork_mode_independent_hint: 'Each variant is voted yes / no / abstain on its own. Any number can pass.',
    fork_mode_competing: 'Competing',
    fork_mode_competing_hint: 'Voters rank all variants together. One winner; others rejected.',
    fork_mode_planned: 'Planned for after first launch',
    forking_from: 'Forking from',
    no_alternative: 'None of these',
    rank_to_vote: 'Drag to rank, then submit',
    rank_submit: 'Submit ranking',
    // create
    create_title: 'New proposal',
    publish_fork: 'Open this fork',
    field_title: 'Title', field_body: 'Body (Markdown)',
    field_rule: 'Voting rule', field_runtime: 'Runtime',
    field_quorum: 'Quorum (optional)',
    runtime_24h: '24 hours', runtime_3d: '3 days',
    runtime_1w: '1 week', runtime_2w: '2 weeks',
    publish: 'Open for voting',
    // members

    role_owner: 'Owner', role_admin: 'Admin', role_moderator: 'Moderator',
    role_member: 'Member', role_observer: 'Observer',
    // invite
    invite_title: 'New invitation',
    invite_role: 'Role on join',
    invite_expiry: 'Expires',
    invite_uses: 'Max uses',
    invite_note: 'Note (private to you)',
    invite_create: 'Create invitation',
    invite_link: 'Shareable link',
    invite_code: 'Code',
    invite_active: 'Active invitations',
    invite_revoke: 'Revoke',
    // join
    join_title: 'Join a project',
    join_sub: 'Enter the 8-character code from your invitation',
    // settings
    settings: 'Preferences',
    theme: 'Theme', theme_system: 'System', theme_light: 'Light', theme_dark: 'Dark',
    language: 'Language',
    sign_out: 'Sign out',
    // misc
    cancel: 'Cancel', save: 'Save', next: 'Next', back: 'Back', done: 'Done',
    confirm_withdraw: 'Withdraw this proposal? Voting will end immediately.',
    no_uses_limit: 'unlimited', no_expiry: 'never',
  },
  pt: {
    appName: 'vozcoletiva',
    tagline: 'decisões coletivas, mantidas em aberto',
    tab_proposals: 'Propostas', tab_members: 'Membros',
    tab_invite: 'Convidar', tab_you: 'Você',
    tab_documents: 'Documentos', tab_messages: 'Mensagens',
    tab_search: 'Buscar',
    signIn: 'Entrar', signUp: 'Criar conta',
    email: 'E-mail', password: 'Senha', displayName: 'Nome de exibição',
    verify_title: 'Verifique seu e-mail',
    verify_sub: 'Enviamos um código de 6 dígitos para',
    verify_cta: 'Verificar',
    auth_or: 'ou',
    have_account: 'Já tem uma conta? Entrar',
    no_account: 'Ainda não tem conta? Crie uma',
    your_projects: 'Seus projetos',
    new_project: 'Novo projeto', join_project: 'Entrar com código',
    proposals: 'Propostas',
    filter_open: 'Em votação', filter_passed: 'Aprovadas',
    filter_rejected: 'Rejeitadas', filter_all: 'Todas',
    new_proposal: 'Nova proposta',
    closes_in: 'encerra em', closed: 'encerrada',
    rule_majority: 'maioria simples', rule_supermajority: 'dois terços',
    quorum: 'quórum', votes: 'votos',
    state_voting: 'Em votação', state_passed: 'Aprovada', state_rejected: 'Rejeitada',
    state_quorum: 'Quórum não atingido', state_withdrawn: 'Retirada',
    your_vote: 'Seu voto', yes: 'Sim', no: 'Não', abstain: 'Abstenção',
    change_vote: 'Alterar voto', retract: 'Retirar voto',
    running_tally: 'Apuração parcial', final_tally: 'Resultado final',
    rule: 'Regra', closes: 'Encerra',
    voted: 'votaram', not_voted: 'não votaram',
    discussion: 'Discussão',
    write_comment: 'Escreva um comentário…',
    edited: 'editado', deleted: '[comentário removido]',
    withdraw: 'Retirar proposta',
    fork: 'Alternativa', fork_verb: 'Propor uma alternativa',
    fork_of: 'Alternativa a',
    variants: 'Alternativas', variants_in_tree: 'alternativas',
    root_label: 'Original',
    decision_header: 'Decisão',
    deliberation_header: 'Questão em aberto',
    rank_to_decide: 'Ordenar para decidir',
    voted_on_this: 'votaram nesta alternativa',
    ranked_so_far: 'ordenaram até agora',
    switch_alt: 'Outras alternativas',
    add_alt: 'Adicionar alternativa',
    fork_mode: 'Modo de decisão',
    fork_mode_independent: 'Independente',
    fork_mode_independent_hint: 'Cada variante é votada sim / não / abstenção. Várias podem ser aprovadas.',
    fork_mode_competing: 'Concorrente',
    fork_mode_competing_hint: 'Os votantes ordenam as variantes. Apenas uma vence.',
    fork_mode_planned: 'Planejado para versão futura',
    forking_from: 'Variante de',
    no_alternative: 'Nenhuma destas',
    rank_to_vote: 'Arraste para ordenar e envie',
    rank_submit: 'Enviar ordenação',
    create_title: 'Nova proposta',
    publish_fork: 'Abrir variante',
    field_title: 'Título', field_body: 'Corpo (Markdown)',
    field_rule: 'Regra de votação', field_runtime: 'Duração',
    field_quorum: 'Quórum (opcional)',
    runtime_24h: '24 horas', runtime_3d: '3 dias',
    runtime_1w: '1 semana', runtime_2w: '2 semanas',
    publish: 'Abrir para votação',

    role_owner: 'Proprietário', role_admin: 'Administrador',
    role_moderator: 'Moderador', role_member: 'Membro', role_observer: 'Observador',
    invite_title: 'Novo convite',
    invite_role: 'Papel ao entrar',
    invite_expiry: 'Validade',
    invite_uses: 'Usos máximos',
    invite_note: 'Anotação (privada)',
    invite_create: 'Criar convite',
    invite_link: 'Link compartilhável',
    invite_code: 'Código',
    invite_active: 'Convites ativos',
    invite_revoke: 'Revogar',
    join_title: 'Entrar em um projeto',
    join_sub: 'Digite o código de 8 caracteres do seu convite',
    settings: 'Preferências',
    theme: 'Tema', theme_system: 'Sistema', theme_light: 'Claro', theme_dark: 'Escuro',
    language: 'Idioma',
    sign_out: 'Sair',
    cancel: 'Cancelar', save: 'Salvar', next: 'Próximo', back: 'Voltar', done: 'Pronto',
    confirm_withdraw: 'Retirar esta proposta? A votação será encerrada imediatamente.',
    no_uses_limit: 'sem limite', no_expiry: 'nunca',
  },
};

// ── sample data ─────────────────────────────────────────────────────────────
const VOZ_NOW = new Date('2026-05-19T15:30:00').getTime();
const hrs = (n) => n * 3600 * 1000;
const days = (n) => n * 24 * 3600 * 1000;

const VOZ_USERS = [
  { id: 'u1', name: 'Marina Costa',    initials: 'MC', tone: 'a' }, // <- you
  { id: 'u2', name: 'Pedro Almeida',   initials: 'PA', tone: 'b' },
  { id: 'u3', name: 'Cláudia Reis',    initials: 'CR', tone: 'c' },
  { id: 'u4', name: 'Bruno Oliveira',  initials: 'BO', tone: 'd' },
  { id: 'u5', name: 'Helena Sá',       initials: 'HS', tone: 'e' },
  { id: 'u6', name: 'Tiago Mendes',    initials: 'TM', tone: 'f' },
  { id: 'u7', name: 'Inês Carvalho',   initials: 'IC', tone: 'g' },
  { id: 'u8', name: 'Rui Ferreira',    initials: 'RF', tone: 'a' },
  { id: 'u9', name: 'Sofia Pinto',     initials: 'SP', tone: 'b' },
  { id: 'u10', name: 'André Lopes',    initials: 'AL', tone: 'c' },
];

const VOZ_PROJECTS = [
  {
    id: 'vmc',
    name: 'Vila Madalena Co-op',
    slug: 'vila-madalena',
    members: 38,
    open: 3,
    myRole: 'owner',
    note: 'Apartment co-op, 24 units',
  },
  {
    id: 'fsbr',
    name: 'Software Livre BR',
    slug: 'softwarelivre-br',
    members: 412,
    open: 1,
    myRole: 'member',
    note: 'Free software volunteers',
  },
  {
    id: 'ndc',
    name: 'Núcleo de Dança Coletiva',
    slug: 'nucleo-danca',
    members: 27,
    open: 0,
    myRole: 'admin',
    note: 'Contact-improv collective',
  },
];

const VOZ_PROPOSALS = [
  {
    id: 'p1', projectId: 'vmc',
    parentId: null, forkMode: 'independent',
    title: 'Replace bicycle storage racks in the garage',
    body: `The existing racks date from 2014 and are corroded — three of them no longer hold a bike securely. Quotes from two local suppliers are attached.\n\nProposed expenditure: **R$ 4,800** from the maintenance reserve.\n\nWork would happen over a weekend in June. Bikes would be temporarily moved to the storage room.`,
    author: 'u3',
    rule: 'majority', runtime: days(5), quorum: null,
    state: 'voting', createdAt: VOZ_NOW - days(3), closesAt: VOZ_NOW + days(2),
    votes: { yes: ['u2','u3','u4','u6','u7','u8','u9','u10'], no: ['u5'], abstain: ['u1'] },
    comments: [
      { id: 'c1', author: 'u5', body: 'Could we get a third quote? The two attached are both from the same neighbourhood.', at: VOZ_NOW - days(2) - hrs(3) },
      { id: 'c2', author: 'u3', body: 'Happy to ask Bicicletaria Pinheiros for a third quote. Will post here by Wednesday.', at: VOZ_NOW - days(2) - hrs(1), edited: true },
      { id: 'c3', author: 'u7', body: 'Thanks for organising this — overdue.', at: VOZ_NOW - hrs(20) },
    ],
  },
  {
    id: 'p2', projectId: 'vmc',
    parentId: null, forkMode: 'independent',
    title: 'Adopt revised noise policy (2026 revision)',
    body: `Quiet hours move from 22:00 → 21:30 on weekdays, with a stricter 60-day grace period for first violations.\n\nFull text attached. This requires a two-thirds majority because it amends the by-laws.`,
    author: 'u2',
    rule: 'supermajority', runtime: days(7), quorum: 20,
    state: 'voting', createdAt: VOZ_NOW - days(6) - hrs(20), closesAt: VOZ_NOW + hrs(4),
    votes: { yes: ['u1','u2','u3','u4','u6','u7','u9','u10'], no: ['u5','u8'], abstain: [] },
    comments: [
      { id: 'c4', author: 'u8', body: 'I worry about families with small kids — they need flexibility. Could we carve out an exception?', at: VOZ_NOW - days(5) },
      { id: 'c5', author: 'u2', body: '@u8 the by-law already allows building-management discretion in good faith — see §4.2.', at: VOZ_NOW - days(4) - hrs(8) },
    ],
  },
  {
    id: 'p3', projectId: 'vmc',
    parentId: null, forkMode: 'competing',
    title: 'Install solar panels on the roof',
    body: `Energy audit completed in March suggests a 14-panel array would offset ~38% of common-area electricity. Financing options laid out in the attached PDF.`,
    author: 'u4',
    rule: 'supermajority', runtime: days(10), quorum: 25,
    state: 'voting', createdAt: VOZ_NOW - days(4), closesAt: VOZ_NOW + days(6),
    votes: { yes: ['u2','u4','u6','u7','u9','u10'], no: ['u5','u8','u3'], abstain: ['u1'] },
    comments: [
      { id: 'c6', author: 'u3', body: 'The capex is significant. I want to see this paired with a maintenance reserve update.', at: VOZ_NOW - days(3) },
    ],
  },
  {
    id: 'p4', projectId: 'vmc',
    parentId: null, forkMode: 'independent',
    title: 'Hire Limpa Sul as new janitorial service',
    body: 'After interviewing four providers, the building committee recommends Limpa Sul. Three-month trial, then renewable.',
    author: 'u3',
    rule: 'majority', runtime: days(7), quorum: null,
    state: 'passed', createdAt: VOZ_NOW - days(12), closesAt: VOZ_NOW - days(5),
    votes: { yes: ['u1','u2','u3','u4','u5','u6','u7','u9'], no: ['u8'], abstain: ['u10'] },
    comments: [],
  },
  {
    id: 'p5', projectId: 'vmc',
    parentId: null, forkMode: 'independent',
    title: 'Allow short-term rentals (e.g. Airbnb)',
    body: 'Proposal to remove §7.4 restricting tenancies under 90 days.',
    author: 'u6',
    rule: 'supermajority', runtime: days(7), quorum: 20,
    state: 'rejected', createdAt: VOZ_NOW - days(40), closesAt: VOZ_NOW - days(33),
    votes: { yes: ['u6','u7'], no: ['u1','u2','u3','u4','u5','u8','u9','u10'], abstain: [] },
    comments: [],
  },
  {
    id: 'p6', projectId: 'vmc',
    parentId: null, forkMode: 'independent',
    title: 'Q1 budget approval (revised)',
    body: 'Withdrawn pending updated reserve numbers.',
    author: 'u1',
    rule: 'majority', runtime: days(5), quorum: null,
    state: 'withdrawn', createdAt: VOZ_NOW - days(20), closesAt: VOZ_NOW - days(15),
    votes: { yes: ['u3','u4'], no: [], abstain: [] },
    comments: [],
  },
  // ─── forks ───────────────────────────────────────────────────────────────
  {
    id: 'p1f1', projectId: 'vmc',
    parentId: 'p1', forkMode: 'independent',
    title: 'Refurbish bicycle racks instead of replacing',
    body: `Alternative to the parent proposal: the racks can be sanded down, re-welded where needed, and repainted by Oficina Bonfim.\n\nQuote attached: **R$ 1,200** plus a Saturday of volunteer help. Saves ~75% over replacement and the same hardware would meet code.`,
    author: 'u5',
    rule: 'majority', runtime: days(5), quorum: null,
    state: 'voting', createdAt: VOZ_NOW - days(2) - hrs(4), closesAt: VOZ_NOW + days(2) + hrs(20),
    votes: { yes: ['u5','u6','u8'], no: ['u3','u7'], abstain: [] },
    comments: [
      { id: 'c1f', author: 'u3', body: 'Worth considering. Can the welds hold the e-bikes (heavier)?', at: VOZ_NOW - days(2) - hrs(2) },
    ],
  },
  {
    id: 'p3f1', projectId: 'vmc',
    parentId: 'p3', forkMode: 'competing',
    title: '20-panel array instead of 14',
    body: `Larger array covers an estimated 54% of common-area electricity. Capex R$ 28,400, payback ~5.6 years on current rates.`,
    author: 'u2',
    rule: 'supermajority', runtime: days(10), quorum: 25,
    state: 'voting', createdAt: VOZ_NOW - days(3) - hrs(6), closesAt: VOZ_NOW + days(6) + hrs(18),
    votes: { yes: ['u2','u4','u9'], no: ['u3','u5','u8'], abstain: ['u1'] },
    comments: [],
  },
  {
    id: 'p3f2', projectId: 'vmc',
    parentId: 'p3', forkMode: 'competing',
    title: 'Lease panels via EcoSolar (no upfront cost)',
    body: `EcoSolar installs and maintains; we pay a fixed monthly fee for 8 years, then own the array outright. No capex, no maintenance burden on the building.\n\nMonthly fee: R$ 480. Estimated monthly saving on common-area bill: R$ 720.`,
    author: 'u7',
    rule: 'supermajority', runtime: days(10), quorum: 25,
    state: 'voting', createdAt: VOZ_NOW - days(2), closesAt: VOZ_NOW + days(8),
    votes: { yes: ['u6','u7','u9','u10'], no: ['u3'], abstain: [] },
    comments: [
      { id: 'c3f2', author: 'u3', body: 'Read the lease terms carefully — what happens if EcoSolar folds in year 4?', at: VOZ_NOW - days(1) - hrs(8) },
    ],
  },
  {
    id: 'p3f1a', projectId: 'vmc',
    parentId: 'p3f1', forkMode: 'competing',
    title: '20-panel array + maintenance reserve top-up',
    body: `As p3f1, plus R$ 6,000 added to the maintenance reserve to cover inverter replacement in year 8.`,
    author: 'u3',
    rule: 'supermajority', runtime: days(10), quorum: 25,
    state: 'voting', createdAt: VOZ_NOW - days(1) - hrs(2), closesAt: VOZ_NOW + days(7),
    votes: { yes: ['u3','u4'], no: [], abstain: [] },
    comments: [],
  },
];

const VOZ_INVITES = [
  { id: 'i1', code: 'K3X7-PNQA', role: 'member', expiresAt: VOZ_NOW + days(14), uses: 0, maxUses: 10, note: 'For new tenants in June' },
  { id: 'i2', code: 'VM-OBSERV', role: 'observer', expiresAt: null, uses: 3, maxUses: null, note: 'Building committee guests' },
];

Object.assign(window, {
  VOZ_PALETTES, VOZ_ACCENTS, VOZ_DENSITY, VOZ_STR,
  VOZ_USERS, VOZ_PROJECTS, VOZ_PROPOSALS, VOZ_INVITES, VOZ_NOW,
  vozTheme,
});

// ── fork-tree helpers ───────────────────────────────────────────────────────
// Walks parent chain to the root. Cycles are impossible by construction (parent
// is set at creation and immutable) but we cap depth defensively anyway.
function vozRootOf(proposal, all) {
  let p = proposal;
  for (let i = 0; i < 32 && p.parentId; i += 1) {
    const next = all.find((x) => x.id === p.parentId);
    if (!next) break;
    p = next;
  }
  return p;
}

function vozParentOf(proposal, all) {
  return proposal.parentId ? all.find((x) => x.id === proposal.parentId) : null;
}

function vozChildrenOf(parentId, all) {
  return all.filter((x) => x.parentId === parentId);
}

// Depth-first flat tree starting at rootId, each entry tagged with depth.
function vozTreeFlat(rootId, all) {
  const out = [];
  const visit = (id, depth) => {
    const node = all.find((x) => x.id === id);
    if (!node) return;
    out.push({ proposal: node, depth });
    vozChildrenOf(id, all).forEach((c) => visit(c.id, depth + 1));
  };
  visit(rootId, 0);
  return out;
}

// Depth-first flat tree enriched with the metadata a tree renderer needs:
// isLast (last sibling at its depth) and ancestorLasts (for each ancestor
// depth, was that ancestor the last sibling?). That's enough to render the
// classic ├── / └── / │   prefix lines.
function vozTreeRows(rootId, all) {
  const rows = [];
  const visit = (id, depth, isLast, ancestorLasts) => {
    const node = all.find((x) => x.id === id);
    if (!node) return;
    rows.push({ proposal: node, depth, isLast, ancestorLasts });
    const children = vozChildrenOf(id, all);
    children.forEach((c, i) => {
      visit(c.id, depth + 1, i === children.length - 1, [...ancestorLasts, isLast]);
    });
  };
  visit(rootId, 0, true, []);
  return rows;
}

Object.assign(window, { vozRootOf, vozParentOf, vozChildrenOf, vozTreeFlat, vozTreeRows });
