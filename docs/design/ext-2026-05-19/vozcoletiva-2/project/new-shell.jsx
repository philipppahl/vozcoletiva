// new-shell.jsx — header + project sheet + new tab screens (documents,
// messages, search). The shell components used to be split into per-screen
// inline headers; this consolidates them and matches the new IA:
// avatar | project name + page title | (action) — with a project selector
// sheet behind the project name, and a 4-tab bar (proposals / documents /
// messages / search).

// ── ProjectHeader: avatar + project + page title ──────────────────────────
function ProjectHeader({
  theme, t, project, pageTitle, onAvatarClick, onProjectClick, rightSlot,
}) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: `${theme.bg}d8`,
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `0.5px solid ${theme.border}`,
      padding: '14px 18px 14px',
      display: 'flex', alignItems: 'center', gap: 14,
      minHeight: 76, boxSizing: 'border-box',
    }}>
      {/* avatar → personal preferences */}
      <button onClick={onAvatarClick}
        aria-label="Open preferences"
        style={{
          appearance: 'none', background: 'transparent', border: 'none',
          padding: 0, cursor: 'pointer', flexShrink: 0,
          borderRadius: 999,
        }}>
        <Avatar user={ME()} size={38} ring={theme.surface} />
      </button>
      {/* middle: project name (clickable) + page title below */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onProjectClick}
          aria-label="Switch project"
          style={{
            appearance: 'none', background: 'transparent', border: 'none',
            padding: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            maxWidth: '100%',
          }}>
          <span style={{
            fontFamily: '"Public Sans", sans-serif',
            fontSize: 11.5, color: theme.inkSoft, fontWeight: 600,
            letterSpacing: 0.05, textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{project ? project.name : 'vozcoletiva'}</span>
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
            <path d="M1 1.5L4.5 4.5L8 1.5" stroke={theme.inkMute}
              strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{
          fontFamily: '"Newsreader", serif', fontWeight: 500,
          fontSize: 26, lineHeight: 1.05, color: theme.ink,
          marginTop: 2, letterSpacing: -0.4, textWrap: 'pretty',
          fontVariationSettings: '"opsz" 32',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{pageTitle}</div>
      </div>
      {rightSlot || <div style={{ width: 38, flexShrink: 0 }} />}
    </div>
  );
}

// ── ProjectSelectorSheet: bottom sheet for switching project + project actions
function ProjectSelectorSheet({
  theme, t, project, projects, open, onClose,
  onPickProject, onCreateProject, onJoinProject,
  onOpenMembers, onOpenInvite, lang,
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* backdrop */}
      <button onClick={onClose}
        aria-label="Close"
        style={{
          appearance: 'none', position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.32)', border: 'none', padding: 0,
          cursor: 'pointer',
        }} />
      {/* sheet */}
      <div style={{
        position: 'relative',
        background: theme.surface, color: theme.ink,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: theme.shadowLg,
        padding: '10px 0 28px', maxHeight: '78%',
        overflowY: 'auto',
        fontFamily: '"Public Sans", sans-serif',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 999, background: theme.border,
          margin: '0 auto 14px',
        }} />
        {/* current project block */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, color: theme.inkMute,
            letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8,
          }}>{lang === 'pt' ? 'Projeto atual' : 'Current project'}</div>
          <div style={{
            padding: '14px 16px',
            background: theme.surface2,
            border: `0.5px solid ${theme.border}`, borderRadius: 16,
          }}>
            <div style={{
              fontFamily: '"Newsreader", serif', fontSize: 19,
              fontWeight: 500, color: theme.ink, lineHeight: 1.2,
              letterSpacing: -0.2,
              fontVariationSettings: '"opsz" 28',
            }}>{project.name}</div>
            <div style={{
              fontSize: 12, color: theme.inkSoft, marginTop: 3,
            }}>
              {t['role_' + project.myRole]} · {project.members} {lang === 'pt' ? 'pessoas' : 'people'}
            </div>
            {/* project actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <SheetAction theme={theme} label={t.tab_members}
                icon={VozIcon.members(theme.ink)}
                onClick={() => { onClose(); onOpenMembers(); }} />
              <SheetAction theme={theme} label={t.tab_invite}
                icon={VozIcon.invite(theme.ink)}
                onClick={() => { onClose(); onOpenInvite(); }} />
            </div>
          </div>
        </div>

        {/* other projects */}
        <div style={{ padding: '6px 18px 0' }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, color: theme.inkMute,
            letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8,
          }}>{lang === 'pt' ? 'Outros projetos' : 'Other projects'}</div>
          <div style={{
            background: theme.surface2,
            borderRadius: 16, overflow: 'hidden',
          }}>
            {projects.filter((p) => p.id !== project.id).map((p, i, arr) => (
              <button key={p.id} onClick={() => { onPickProject(p.id); onClose(); }}
                style={{
                  appearance: 'none', cursor: 'pointer', width: '100%',
                  background: 'transparent', border: 'none', textAlign: 'left',
                  padding: '13px 14px',
                  borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${theme.border}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14.5, fontWeight: 500, color: theme.ink, lineHeight: 1.3,
                  }}>{p.name}</div>
                  <div style={{
                    fontSize: 11.5, color: theme.inkMute, marginTop: 2,
                  }}>{t['role_' + p.myRole]} · {p.members} {lang === 'pt' ? 'pessoas' : 'people'}{p.open > 0 ? ` · ${p.open} ${t.filter_open.toLowerCase()}` : ''}</div>
                </div>
                {p.open > 0 && (
                  <span style={{
                    width: 7, height: 7, borderRadius: 999, background: theme.accent,
                    flexShrink: 0,
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* add-a-project actions */}
        <div style={{ padding: '14px 18px 0', display: 'flex', gap: 10 }}>
          <Button theme={theme} block onClick={() => { onClose(); onCreateProject(); }}>
            {VozIcon.plus(theme.ink)} <span>{t.new_project}</span>
          </Button>
          <Button theme={theme} block onClick={() => { onClose(); onJoinProject(); }}>
            {t.join_project}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SheetAction({ theme, label, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer',
      height: 32, padding: '0 12px', borderRadius: 8,
      background: theme.surface, border: `1px solid ${theme.borderHi}`,
      color: theme.ink,
      fontFamily: '"Public Sans", sans-serif', fontSize: 13,
      fontWeight: 500, letterSpacing: 0.01,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ display: 'inline-flex', transform: 'scale(0.85)' }}>{icon}</span>
      {label}
    </button>
  );
}

// ── DocumentsScreen — placeholder for the planned Document proposal type ──
function DocumentsScreen({ theme, t, lang }) {
  // Sample placeholder documents matching the brief: "Document proposals become
  // versioned canonical documents (statutes, policies, bylaws). Amendments diff
  // against earlier versions."
  const samples = [
    {
      title: lang === 'pt' ? 'Regulamento interno' : 'House rules',
      version: 'v4',
      passed: lang === 'pt' ? 'aprovado em 12 fev' : 'passed 12 Feb',
      pages: 14,
    },
    {
      title: lang === 'pt' ? 'Política de ruído (revisão 2026)' : 'Noise policy (2026 revision)',
      version: 'v2 · proposed',
      passed: lang === 'pt' ? 'aguardando votação' : 'voting open',
      pages: 3,
      pending: true,
    },
    {
      title: lang === 'pt' ? 'Estatuto do condomínio' : 'Co-op statutes',
      version: 'v1',
      passed: lang === 'pt' ? 'aprovado em 4 jan 2024' : 'passed 4 Jan 2024',
      pages: 28,
    },
  ];
  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card theme={theme} padded={false} style={{ borderStyle: 'dashed' }}>
        <div style={{ padding: 16 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: theme.accent, fontWeight: 600, letterSpacing: 1.5,
            padding: '2px 6px', border: `1px solid ${theme.accent}`,
            borderRadius: 4, textTransform: 'uppercase',
          }}>{lang === 'pt' ? 'previsto' : 'planned'}</span>
          <div style={{
            marginTop: 10, fontSize: 13.5, color: theme.inkSoft, lineHeight: 1.55,
            fontFamily: '"Public Sans", sans-serif',
          }}>
            {lang === 'pt'
              ? 'Propostas do tipo "documento" virarão textos canônicos versionados — estatutos, regulamentos, políticas. Emendas serão diff contra versões anteriores.'
              : 'Document proposals will become versioned canonical texts — statutes, by-laws, policies. Amendments diff against prior versions.'}
          </div>
        </div>
      </Card>
      {samples.map((d, i) => (
        <Card key={i} theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 50, borderRadius: 4,
              background: theme.surface2,
              border: `1px solid ${theme.border}`, flexShrink: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              padding: '4px 5px',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
              color: theme.inkMute,
            }}>{d.version}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: '"Newsreader", serif', fontSize: 17, fontWeight: 500,
                color: theme.ink, lineHeight: 1.25, letterSpacing: -0.2,
                fontVariationSettings: '"opsz" 24',
              }}>{d.title}</div>
              <div style={{
                fontSize: 12, color: d.pending ? theme.accent : theme.inkMute, marginTop: 3,
                fontFamily: '"Public Sans", sans-serif', fontWeight: d.pending ? 600 : 400,
              }}>{d.passed} · {d.pages} {lang === 'pt' ? 'pág.' : 'pp'}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── MessagesScreen — placeholder for the planned per-project chat ─────────
function MessagesScreen({ theme, t, lang }) {
  // Sample channels reflect the brief's "Chat: per-project channels for fast
  // informal conversation; text, image attachments, voice notes."
  const channels = [
    { name: '#general',  last: lang === 'pt' ? 'Tiago: já achei outra cotação' : 'Tiago: found another quote',     at: '12m', unread: 3 },
    { name: '#bicicletas', last: lang === 'pt' ? 'Helena: foto das soldas' : 'Helena: photo of the welds',      at: '1h', unread: 0 },
    { name: '#manutenção', last: lang === 'pt' ? 'Bruno: 📎 cotação_v2.pdf' : 'Bruno: 📎 quote_v2.pdf', at: '3h', unread: 1 },
    { name: '#offtopic',  last: lang === 'pt' ? 'Marina: feliz aniversário Pedro!' : 'Marina: happy birthday Pedro!', at: 'yesterday', unread: 0 },
  ];
  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card theme={theme} padded={false} style={{ borderStyle: 'dashed' }}>
        <div style={{ padding: 16 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: theme.accent, fontWeight: 600, letterSpacing: 1.5,
            padding: '2px 6px', border: `1px solid ${theme.accent}`,
            borderRadius: 4, textTransform: 'uppercase',
          }}>{lang === 'pt' ? 'previsto' : 'planned'}</span>
          <div style={{
            marginTop: 10, fontSize: 13.5, color: theme.inkSoft, lineHeight: 1.55,
            fontFamily: '"Public Sans", sans-serif',
          }}>
            {lang === 'pt'
              ? 'Canais por projeto para conversa rápida e informal. Texto, imagens e notas de voz. Não substitui a deliberação — só agiliza o trabalho ao lado dela.'
              : 'Per-project channels for fast, informal talk. Text, images and voice notes. Not a replacement for deliberation — just lighter chatter alongside it.'}
          </div>
        </div>
      </Card>
      {channels.map((c) => (
        <Card key={c.name} theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: theme.surface2, border: `1px solid ${theme.border}`,
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 14, color: theme.inkSoft,
            }}>#</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{
                  fontFamily: '"Public Sans", sans-serif', fontSize: 14.5, fontWeight: 600,
                  color: theme.ink,
                }}>{c.name}</span>
                <span style={{
                  fontSize: 11, color: theme.inkMute,
                  fontFamily: '"Public Sans", sans-serif',
                }}>{c.at}</span>
              </div>
              <div style={{
                fontSize: 12.5, color: theme.inkSoft, marginTop: 2,
                fontFamily: '"Public Sans", sans-serif',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.last}</div>
            </div>
            {c.unread > 0 && (
              <span style={{
                minWidth: 22, height: 22, padding: '0 7px',
                background: theme.accent, color: theme.accentInk,
                borderRadius: 999, fontSize: 11, fontWeight: 600,
                fontFamily: '"Public Sans", sans-serif',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{c.unread}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── SearchScreen — functional search across proposals + people + documents
function SearchScreen({ theme, t, proposals, project, lang, onOpenProposal }) {
  const [q, setQ] = React.useState('');
  const norm = q.trim().toLowerCase();
  const matches = norm.length === 0 ? [] : proposals.filter((p) =>
    p.title.toLowerCase().includes(norm)
    || p.body.toLowerCase().includes(norm)
  );
  const matchedMembers = norm.length === 0 ? [] : VOZ_USERS.filter((u) =>
    u.name.toLowerCase().includes(norm)
  );
  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ position: 'relative' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={lang === 'pt' ? 'Buscar propostas, pessoas, documentos…' : 'Search proposals, people, documents…'}
          autoFocus
          style={{
            appearance: 'none', width: '100%', boxSizing: 'border-box',
            height: 48, padding: '0 16px 0 42px',
            background: theme.fieldBg, color: theme.ink,
            border: `1px solid ${theme.border}`, borderRadius: 12,
            outline: 'none',
            fontFamily: '"Public Sans", sans-serif', fontSize: 15,
          }} />
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            color: theme.inkMute, pointerEvents: 'none',
          }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      {norm.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: theme.inkSoft,
            letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 10,
            padding: '0 4px', fontFamily: '"Public Sans", sans-serif',
          }}>{lang === 'pt' ? 'Sugestões' : 'Try'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(lang === 'pt'
              ? ['bicicletas', 'ruído', 'solar', 'Helena Sá', 'estatuto']
              : ['bicycle', 'noise', 'solar', 'Helena Sá', 'statutes']
            ).map((s) => (
              <button key={s} onClick={() => setQ(s)} style={{
                appearance: 'none', cursor: 'pointer',
                height: 30, padding: '0 12px', borderRadius: 999,
                background: theme.surface, border: `1px solid ${theme.border}`,
                color: theme.ink,
                fontFamily: '"Public Sans", sans-serif', fontSize: 13,
                fontWeight: 500,
              }}>{s}</button>
            ))}
          </div>
        </div>
      ) : (matches.length === 0 && matchedMembers.length === 0) ? (
        <div style={{
          marginTop: 36, textAlign: 'center', color: theme.inkMute,
          fontFamily: '"Public Sans", sans-serif', fontSize: 14,
        }}>{lang === 'pt' ? 'Nada encontrado.' : 'Nothing found.'}</div>
      ) : (
        <div style={{ marginTop: 18 }}>
          {matches.length > 0 && (
            <SearchSection theme={theme} label={t.proposals} count={matches.length}>
              {matches.map((p) => (
                <SearchResultProposal key={p.id} p={p} theme={theme} t={t}
                  onClick={() => onOpenProposal(p.id)} />
              ))}
            </SearchSection>
          )}
          {matchedMembers.length > 0 && (
            <SearchSection theme={theme} label={t.tab_members} count={matchedMembers.length}>
              {matchedMembers.map((u) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: theme.surface,
                  border: `1px solid ${theme.border}`, borderRadius: 10,
                }}>
                  <Avatar user={u} size={30} />
                  <span style={{
                    fontFamily: '"Public Sans", sans-serif', fontSize: 14, fontWeight: 500,
                    color: theme.ink,
                  }}>{u.name}</span>
                </div>
              ))}
            </SearchSection>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSection({ theme, label, count, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: theme.inkSoft,
        letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8,
        padding: '0 4px', fontFamily: '"Public Sans", sans-serif',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{label}</span>
        <span style={{ color: theme.inkMute, fontWeight: 500 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function SearchResultProposal({ p, theme, t, onClick }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', textAlign: 'left',
      padding: '12px 14px',
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 10, fontFamily: '"Public Sans", sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <StateBadge state={p.state} theme={theme} t={t} />
      </div>
      <div style={{
        fontFamily: '"Newsreader", serif', fontSize: 16, fontWeight: 500,
        color: theme.ink, lineHeight: 1.25, letterSpacing: -0.15,
        fontVariationSettings: '"opsz" 24',
      }}>{p.title}</div>
      <div style={{
        marginTop: 4, fontSize: 12, color: theme.inkMute,
      }}>{findUser(p.author).name} · {ruleLabel(p.rule, t)}</div>
    </button>
  );
}

Object.assign(window, {
  ProjectHeader, ProjectSelectorSheet,
  DocumentsScreen, MessagesScreen, SearchScreen,
});
