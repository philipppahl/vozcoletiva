// screens.jsx — all screens. Reads from window globals (theme, ui, data).

const { useState, useEffect, useMemo, useRef } = React;

// ── helpers ────────────────────────────────────────────────────────────────
function findUser(id) { return VOZ_USERS.find(u => u.id === id); }
function ME() { return VOZ_USERS[0]; } // Marina Costa (u1)

function ruleLabel(rule, t) {
  return rule === 'supermajority' ? t.rule_supermajority : t.rule_majority;
}

// Minimal markdown renderer — paragraphs, **bold**, *italic*, line breaks.
function renderMD(body, theme) {
  const paras = body.split(/\n\n+/);
  return paras.map((p, i) => {
    const html = p
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
    return <p key={i} style={{
      margin: '0 0 14px', color: theme.ink, fontSize: 15.5, lineHeight: 1.65,
      fontFamily: '"Public Sans", system-ui, sans-serif',
    }} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

// ── top chrome (in-app) ────────────────────────────────────────────────────
function TopBar({ theme, t, project, onBack, onMenu, onProjectClick, title, sticky = true }) {
  return (
    <div style={{
      position: sticky ? 'sticky' : 'static', top: 0, zIndex: 10,
      background: `${theme.bg}d8`,
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `0.5px solid ${theme.border}`,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 62, boxSizing: 'border-box',
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          appearance: 'none', background: 'transparent', border: 'none',
          padding: 6, cursor: 'pointer', borderRadius: 8,
          color: theme.ink, display: 'inline-flex', flexShrink: 0,
        }}>{VozIcon.back(theme.ink)}</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <VozMark size={22} color={theme.ink} accent={theme.accent} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {project && (
          <button onClick={onProjectClick} disabled={!onProjectClick} style={{
            appearance: 'none', background: 'transparent', border: 'none',
            padding: 0, cursor: onProjectClick ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            maxWidth: '100%', color: theme.inkMute,
          }}>
            <span style={{
              fontSize: 11, color: theme.inkMute, fontWeight: 600,
              letterSpacing: 0.05, textTransform: 'uppercase',
              lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{project.name}</span>
            {onProjectClick && (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor"
                  strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
        <div style={{
          fontFamily: '"Public Sans", sans-serif', fontWeight: 600,
          fontSize: 16, color: theme.ink, lineHeight: 1.2,
          marginTop: project ? 2 : 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
      </div>
      {onMenu && (
        <button onClick={onMenu} style={{
          appearance: 'none', background: 'transparent', border: 'none',
          padding: 8, cursor: 'pointer', borderRadius: 8,
          color: theme.inkSoft, display: 'inline-flex', flexShrink: 0,
        }}>{VozIcon.dots(theme.inkSoft)}</button>
      )}
    </div>
  );
}

// ── tab bar ────────────────────────────────────────────────────────────────
function TabBar({ theme, t, current, onChange }) {
  const tabs = [
    { id: 'proposals', label: t.tab_proposals, icon: VozIcon.proposals },
    { id: 'documents', label: t.tab_documents, icon: VozIcon.documents },
    { id: 'messages',  label: t.tab_messages,  icon: VozIcon.messages },
    { id: 'search',    label: t.tab_search,    icon: VozIcon.search },
  ];
  return (
    <div style={{
      borderTop: `0.5px solid ${theme.border}`,
      background: `${theme.surface}e8`,
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      padding: '8px 12px 18px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
    }}>
      {tabs.map(tab => {
        const active = current === tab.id;
        const color = active ? theme.ink : theme.inkMute;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            appearance: 'none', background: 'transparent', border: 'none',
            padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            color,
          }}>
            {tab.icon(color)}
            <span style={{
              fontFamily: '"Public Sans", sans-serif', fontSize: 10.5,
              fontWeight: active ? 600 : 500, letterSpacing: 0.01,
            }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH FLOW
// ═══════════════════════════════════════════════════════════════════════════
function AuthScreen({ theme, t, mode, setMode, onAuth }) {
  const [email, setEmail] = useState('marina@example.com');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('Marina Costa');
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '40px 22px 24px', overflowY: 'auto', background: theme.bg,
    }}>
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <VozWordmark size={28} color={theme.ink} accent={theme.accent} />
        <div style={{
          marginTop: 14, fontFamily: '"Newsreader", serif',
          fontSize: 22, fontStyle: 'italic', lineHeight: 1.3,
          color: theme.inkSoft, fontVariationSettings: '"opsz" 36',
        }}>{t.tagline}.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {mode === 'signup' && (
          <Field label={t.displayName} value={name} onChange={setName} theme={theme} />
        )}
        <Field label={t.email} value={email} onChange={setEmail} theme={theme} type="email" />
        <Field label={t.password} value={password} onChange={setPassword} theme={theme} type="password" />
        <div style={{ marginTop: 8 }}>
          <Button variant="primary" size="lg" block theme={theme} onClick={() => onAuth(mode)}>
            {mode === 'signup' ? t.signUp : t.signIn}
          </Button>
        </div>
        <button onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          style={{
            appearance: 'none', background: 'transparent', border: 'none',
            color: theme.inkSoft, fontFamily: '"Public Sans", sans-serif',
            fontSize: 14, padding: 12, cursor: 'pointer',
            textAlign: 'center', textDecoration: 'underline',
            textDecorationColor: theme.border, textUnderlineOffset: 4,
          }}>
          {mode === 'signup' ? t.have_account : t.no_account}
        </button>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{
        textAlign: 'center', fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10, color: theme.inkMute, letterSpacing: 2,
        textTransform: 'uppercase', paddingTop: 32,
      }}>vozcoletiva.com · open source</div>
    </div>
  );
}

function VerifyScreen({ theme, t, email, onVerify, onBack }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef([]);
  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(0, 1);
    const arr = [...digits]; arr[i] = d; setDigits(arr);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const complete = digits.every(x => x);
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '40px 22px 24px', overflowY: 'auto', background: theme.bg,
    }}>
      <button onClick={onBack} style={{
        appearance: 'none', background: 'transparent', border: 'none',
        padding: 6, cursor: 'pointer', alignSelf: 'flex-start',
        color: theme.ink,
      }}>{VozIcon.back(theme.ink)}</button>
      <div style={{ marginTop: 32 }}>
        <h1 style={{
          fontFamily: '"Newsreader", serif', fontWeight: 400,
          fontSize: 34, lineHeight: 1.1, color: theme.ink, margin: 0,
          fontVariationSettings: '"opsz" 36',
        }}>{t.verify_title}</h1>
        <div style={{
          marginTop: 10, fontSize: 15, lineHeight: 1.5, color: theme.inkSoft,
          fontFamily: '"Public Sans", sans-serif',
        }}>
          {t.verify_sub} <span style={{ color: theme.ink, fontWeight: 500 }}>{email}</span>.
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8,
        marginTop: 36,
      }}>
        {digits.map((d, i) => (
          <input key={i} ref={el => refs.current[i] = el}
            value={d} onChange={(e) => setDigit(i, e.target.value)}
            inputMode="numeric" maxLength={1}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) refs.current[i-1]?.focus();
            }}
            style={{
              appearance: 'none', textAlign: 'center',
              height: 56, fontSize: 28, fontWeight: 500,
              fontFamily: '"JetBrains Mono", monospace',
              background: theme.fieldBg, color: theme.ink,
              border: `1px solid ${d ? theme.accent : theme.border}`,
              borderRadius: 10, outline: 'none',
            }} />
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <Button variant="primary" size="lg" block theme={theme}
          disabled={!complete} onClick={onVerify}>
          {t.verify_cta}
        </Button>
      </div>
      <button style={{
        appearance: 'none', background: 'transparent', border: 'none',
        marginTop: 16, color: theme.inkSoft, fontSize: 13,
        fontFamily: '"Public Sans", sans-serif', cursor: 'pointer',
      }}>Resend code (45s)</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS LIST (cross-project home)
// ═══════════════════════════════════════════════════════════════════════════
function ProjectsScreen({ theme, t, onPick, onCreate, onJoin }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: theme.bg, overflowY: 'auto',
    }}>
      <div style={{ padding: '24px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <VozWordmark size={20} color={theme.ink} accent={theme.accent} />
          <Avatar user={ME()} size={32} ring={theme.surface} />
        </div>
        <h1 style={{
          fontFamily: '"Newsreader", serif', fontWeight: 400, margin: '24px 0 0',
          fontSize: 36, lineHeight: 1.05, color: theme.ink, letterSpacing: -0.5,
          fontVariationSettings: '"opsz" 36',
        }}>{t.your_projects}</h1>
      </div>
      <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {VOZ_PROJECTS.map(p => {
          const memberUsers = VOZ_USERS.slice(0, 6);
          return (
            <Card key={p.id} theme={theme} onClick={() => onPick(p.id)} padded={false}>
              <div style={{ padding: 18 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline',
                  justifyContent: 'space-between', gap: 8,
                }}>
                  <h2 style={{
                    fontFamily: '"Newsreader", serif', fontWeight: 500,
                    fontSize: 22, lineHeight: 1.2, color: theme.ink, margin: 0,
                    letterSpacing: -0.3,
                    fontVariationSettings: '"opsz" 36',
                  }}>{p.name}</h2>
                  <Pill tone="neutral" theme={theme} size="sm">
                    {t['role_' + p.myRole]}
                  </Pill>
                </div>
                <div style={{
                  marginTop: 6, fontSize: 13, color: theme.inkSoft,
                  fontFamily: '"Public Sans", sans-serif',
                }}>{p.note} · {p.members} {t.tab_members.toLowerCase()}</div>
                <div style={{
                  marginTop: 14, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <AvatarStack users={memberUsers} size={22} max={5} theme={theme} />
                  {p.open > 0 ? (
                    <Pill tone="accent" theme={theme}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 999, background: theme.accent,
                      }} />
                      {p.open} {t.filter_open.toLowerCase()}
                    </Pill>
                  ) : (
                    <span style={{
                      fontSize: 12, color: theme.inkMute,
                      fontFamily: '"Public Sans", sans-serif',
                    }}>no open proposals</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button theme={theme} block onClick={onCreate}>
            {VozIcon.plus(theme.ink)} <span>{t.new_project}</span>
          </Button>
          <Button theme={theme} block onClick={onJoin}>{t.join_project}</Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT HOME — list of deliberations (tree-grouped), not raw proposals
// ═══════════════════════════════════════════════════════════════════════════
function ProjectHomeScreen({
  theme, t, project, proposals, filter, setFilter,
  onOpen, onCompose, onAvatarClick, onProjectClick,
}) {
  // Build deliberations: group every proposal under its root. The list unit is
  // the TREE, not the individual proposal — that's what "forking is first-class"
  // means in the home view. Trees are sorted by most-recent activity.
  const deliberations = React.useMemo(() => {
    const groups = {};
    proposals.forEach((p) => {
      const r = vozRootOf(p, proposals);
      if (!groups[r.id]) groups[r.id] = { root: r, items: [] };
      groups[r.id].items.push(p);
    });
    return Object.values(groups).map((g) => {
      const flat = vozTreeFlat(g.root.id, proposals);
      const anyOpen = flat.some((n) => n.proposal.state === 'voting');
      const anyPassed = flat.some((n) => n.proposal.state === 'passed');
      const state = anyOpen ? 'voting'
        : anyPassed ? 'passed'
        : (g.root.state || 'rejected');
      const latest = Math.max(...flat.map((n) => n.proposal.createdAt));
      return { root: g.root, flat, state, latest };
    }).sort((a, b) => {
      // open first, then by recency
      if ((a.state === 'voting') !== (b.state === 'voting')) {
        return a.state === 'voting' ? -1 : 1;
      }
      return b.latest - a.latest;
    });
  }, [proposals]);

  const filtered = deliberations.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'voting') return d.state === 'voting';
    if (filter === 'passed') return d.state === 'passed';
    if (filter === 'rejected') return d.state === 'rejected' || d.state === 'quorum';
    return true;
  });

  const counts = {
    voting:   deliberations.filter((d) => d.state === 'voting').length,
    passed:   deliberations.filter((d) => d.state === 'passed').length,
    rejected: deliberations.filter((d) => d.state === 'rejected' || d.state === 'quorum').length,
    all:      deliberations.length,
  };

  const filterChips = [
    { id: 'voting',   label: t.filter_open,     n: counts.voting },
    { id: 'passed',   label: t.filter_passed,   n: counts.passed },
    { id: 'rejected', label: t.filter_rejected, n: counts.rejected },
    { id: 'all',      label: t.filter_all,      n: counts.all },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <ProjectHeader theme={theme} t={t} project={project}
        pageTitle={t.proposals}
        onAvatarClick={onAvatarClick} onProjectClick={onProjectClick} />
      {/* filter chips */}
      <div className="voz-noscroll" style={{
        padding: '14px 16px 4px', display: 'flex', gap: 6,
        overflowX: 'auto', flexShrink: 0,
      }}>
        {filterChips.map(c => {
          const on = filter === c.id;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              appearance: 'none', cursor: 'pointer', flexShrink: 0,
              height: 32, padding: '0 12px', borderRadius: 999,
              border: `1px solid ${on ? theme.ink : theme.border}`,
              background: on ? theme.ink : 'transparent',
              color: on ? theme.bg : theme.inkSoft,
              fontFamily: '"Public Sans", sans-serif', fontSize: 13,
              fontWeight: on ? 600 : 500, letterSpacing: 0.01,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span>{c.label}</span>
              <span style={{
                fontSize: 11, color: on ? `${theme.bg}aa` : theme.inkMute,
                fontVariantNumeric: 'tabular-nums',
              }}>{c.n}</span>
            </button>
          );
        })}
      </div>
      {/* deliberations list */}
      <div style={{ padding: '14px 16px 96px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center', color: theme.inkMute,
            fontFamily: '"Public Sans", sans-serif', fontSize: 14,
            border: `1px dashed ${theme.border}`, borderRadius: 12,
          }}>Nothing here yet.</div>
        ) : filtered.map((d) => {
          if (d.flat.length === 1) {
            return <ProposalCard key={d.root.id} theme={theme} t={t}
              proposal={d.root} onOpen={() => onOpen(d.root.id)} />;
          }
          return <DeliberationCard key={d.root.id} theme={theme} t={t}
            deliberation={d} onOpen={onOpen} />;
        })}
      </div>
      {/* floating compose */}
      <button onClick={onCompose} style={{
        position: 'sticky', bottom: 16, marginLeft: 'auto', marginRight: 16,
        appearance: 'none', cursor: 'pointer',
        height: 56, borderRadius: 999, padding: '0 22px',
        background: theme.ink, color: theme.bg, border: 'none',
        boxShadow: theme.shadowLg,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: '"Public Sans", sans-serif', fontSize: 15, fontWeight: 600,
        letterSpacing: -0.005,
      }}>
        {VozIcon.plus(theme.bg)}
        <span>{t.new_proposal}</span>
      </button>
    </div>
  );
}

// DeliberationCard — multi-variant card. Shows the root title prominently, the
// alternatives stacked beneath with their own tallies/timing. Visually one
// "topic on the table" rather than N separate items competing for attention.
function DeliberationCard({ deliberation, theme, t, onOpen }) {
  const { root, flat, state } = deliberation;
  const mode = root.forkMode || 'independent';
  const isCompeting = mode === 'competing';
  const lang = t === VOZ_STR.pt ? 'pt' : 'en';
  // The closing time relevant at the deliberation level: nearest still-open close.
  const openItems = flat.filter((n) => n.proposal.state === 'voting');
  const nextClose = openItems.length
    ? Math.min(...openItems.map((n) => n.proposal.closesAt))
    : null;
  const timeLeft = nextClose ? nextClose - VOZ_NOW : 0;

  return (
    <Card theme={theme} padded={false}
      onClick={() => onOpen(root.id)}>
      <div style={{ padding: 16 }}>
        {/* header strip: state + count + mode + time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 8, flexWrap: 'wrap',
        }}>
          <StateBadge state={state} theme={theme} t={t} />
          <ForkModeBadge mode={mode} theme={theme} t={t} />
          <span style={{
            fontSize: 12, color: theme.inkSoft, fontWeight: 500,
            fontFamily: '"Public Sans", sans-serif',
          }}>{flat.length} {t.variants.toLowerCase()}</span>
          {nextClose && (
            <span style={{
              marginLeft: 'auto',
              fontFamily: '"Public Sans", sans-serif', fontSize: 12,
              color: timeLeft < 86400000 ? theme.warn : theme.inkSoft, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {VozIcon.clock(timeLeft < 86400000 ? theme.warn : theme.inkSoft)}
              {t.closes_in} {fmtTimeLeft(timeLeft, lang)}
            </span>
          )}
        </div>
        {/* root title — the question on the table */}
        <h3 style={{
          fontFamily: '"Newsreader", serif', fontWeight: 500,
          fontSize: 20, lineHeight: 1.2, color: theme.ink, margin: 0,
          letterSpacing: -0.25, textWrap: 'pretty',
          fontVariationSettings: '"opsz" 32',
        }}>{root.title}</h3>

        {/* alternatives stack */}
        <div style={{
          marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2,
          background: theme.surface2,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {flat.map((node, i) => (
            <DeliberationRow key={node.proposal.id} node={node} idx={i}
              theme={theme} t={t} lang={lang}
              ranked={isCompeting} isLast={i === flat.length - 1}
              onClick={(e) => { e.stopPropagation(); onOpen(node.proposal.id); }} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function DeliberationRow({ node, idx, theme, t, lang, ranked, isLast, onClick }) {
  const p = node.proposal;
  const isRoot = !p.parentId;
  const y = p.votes.yes.length;
  const n = p.votes.no.length;
  const a = p.votes.abstain.length;
  const total = y + n + a;
  const pct = (x) => total === 0 ? 0 : (x / total * 100);
  return (
    <button onClick={onClick} style={{
      appearance: 'none', background: 'transparent',
      border: 'none', textAlign: 'left', cursor: 'pointer',
      padding: '10px 12px',
      borderBottom: isLast ? 'none' : `1px solid ${theme.border}`,
      display: 'flex', gap: 12, alignItems: 'center',
      fontFamily: '"Public Sans", sans-serif',
    }}>
      <div style={{
        width: 22, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: theme.inkSoft,
      }}>
        {ranked ? (
          <span style={{
            fontFamily: '"Newsreader", serif', fontSize: 18,
            fontWeight: 500, color: theme.ink,
            fontVariationSettings: '"opsz" 24',
          }}>{idx + 1}</span>
        ) : isRoot ? (
          <span style={{
            width: 6, height: 6, borderRadius: 999, background: theme.accent,
          }} />
        ) : (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
          }}>↳</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: theme.ink, lineHeight: 1.3,
          textWrap: 'pretty',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{p.title}</div>
        <div style={{
          fontSize: 11.5, color: theme.inkMute, marginTop: 2,
          display: 'flex', gap: 6,
        }}>
          <span>{findUser(p.author).name}</span>
          {p.state !== 'voting' && (
            <>
              <span style={{ color: theme.border }}>·</span>
              <span>{t['state_' + p.state]?.toLowerCase()}</span>
            </>
          )}
        </div>
      </div>
      {!ranked && total > 0 && (
        <div style={{
          width: 76, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{
            display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden',
            background: theme.surface,
          }}>
            <div style={{ width: `${pct(y)}%`, background: theme.yes }} />
            <div style={{ width: `${pct(n)}%`, background: theme.no }} />
            <div style={{ width: `${pct(a)}%`, background: theme.abstain, opacity: 0.4 }} />
          </div>
          <div style={{
            fontSize: 11, color: theme.inkMute, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ color: theme.yes, fontWeight: 600 }}>{y}</span>
            <span style={{ color: theme.border }}>/</span>
            <span style={{ color: theme.no, fontWeight: 600 }}>{n}</span>
            <span style={{ color: theme.border }}>/</span>
            <span>{a}</span>
          </div>
        </div>
      )}
    </button>
  );
}

function ProposalCard({ proposal, theme, t, onOpen }) {
  const author = findUser(proposal.author);
  const y = proposal.votes.yes.length;
  const n = proposal.votes.no.length;
  const a = proposal.votes.abstain.length;
  const total = y + n + a;
  const timeLeft = proposal.closesAt - VOZ_NOW;
  const isOpen = proposal.state === 'voting';
  const pct = (x) => total === 0 ? 0 : (x / total * 100);
  return (
    <Card theme={theme} onClick={onOpen} padded={false}>
      <div style={{ padding: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 8, gap: 8,
        }}>
          <StateBadge state={proposal.state} theme={theme} t={t} />
          {isOpen ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: '"Public Sans", sans-serif', fontSize: 12,
              color: timeLeft < 86400000 ? theme.warn : theme.inkSoft, fontWeight: 500,
            }}>
              {VozIcon.clock(timeLeft < 86400000 ? theme.warn : theme.inkSoft)}
              <span>{t.closes_in} {fmtTimeLeft(timeLeft, t === VOZ_STR.pt ? 'pt' : 'en')}</span>
            </div>
          ) : (
            <span style={{
              fontFamily: '"Public Sans", sans-serif', fontSize: 12,
              color: theme.inkMute, fontWeight: 500,
            }}>{fmtAgo(proposal.closesAt, t === VOZ_STR.pt ? 'pt' : 'en')}</span>
          )}
        </div>
        <h3 style={{
          fontFamily: '"Newsreader", serif', fontWeight: 500,
          fontSize: 19, lineHeight: 1.25, color: theme.ink, margin: 0,
          letterSpacing: -0.2, textWrap: 'pretty',
          fontVariationSettings: '"opsz" 32',
        }}>{proposal.title}</h3>
        <div style={{
          marginTop: 8, fontSize: 12, color: theme.inkSoft,
          fontFamily: '"Public Sans", sans-serif',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <Avatar user={author} size={18} />
          <span>{author.name}</span>
          <span style={{ color: theme.border }}>·</span>
          <span>{ruleLabel(proposal.rule, t)}</span>
          {proposal.quorum && (
            <>
              <span style={{ color: theme.border }}>·</span>
              <span>{t.quorum} {proposal.quorum}</span>
            </>
          )}
        </div>
        {total > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden',
              background: theme.surface2,
            }}>
              <div style={{ width: `${pct(y)}%`, background: theme.yes }} />
              <div style={{ width: `${pct(n)}%`, background: theme.no }} />
              <div style={{ width: `${pct(a)}%`, background: theme.abstain, opacity: 0.4 }} />
            </div>
            <div style={{
              marginTop: 6, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 8,
              fontFamily: '"Public Sans", sans-serif', fontSize: 11.5,
              color: theme.inkMute, whiteSpace: 'nowrap',
            }}>
              <span>
                <span style={{ color: theme.yes, fontWeight: 600 }}>{y}</span>
                {' / '}
                <span style={{ color: theme.no, fontWeight: 600 }}>{n}</span>
                {' / '}
                <span>{a}</span>
                {' · '}{total} {t.votes}
              </span>
              {proposal.comments.length > 0 && (
                <span>{proposal.comments.length} {proposal.comments.length === 1
                  ? (t === VOZ_STR.pt ? 'comentário' : 'comment')
                  : (t === VOZ_STR.pt ? 'comentários' : 'comments')}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

Object.assign(window, {
  AuthScreen, VerifyScreen, ProjectsScreen, ProjectHomeScreen,
  TopBar, TabBar, ProposalCard, findUser, ME, renderMD, ruleLabel,
});
