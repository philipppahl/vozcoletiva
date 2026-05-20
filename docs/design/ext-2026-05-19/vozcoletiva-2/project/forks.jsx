// forks.jsx — fork-tree UI. Fork is a *first-class* concept: alternatives sit
// at the top of every proposal page, not in a sidebar. In competing mode the
// whole page pivots to a tree-level decision view.

// ── fork-mode pill ─────────────────────────────────────────────────────────
function ForkModeBadge({ mode, theme, t }) {
  if (!mode) return null;
  const isCompeting = mode === 'competing';
  return (
    <Pill tone={isCompeting ? 'accent' : 'neutral'} theme={theme} size="sm">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
        {isCompeting ? (
          <>
            <path d="M1 2h6M1 5.5h4M1 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M8 8L10 6L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </>
        ) : (
          <>
            <circle cx="2" cy="2" r="1.3" stroke="currentColor" strokeWidth="1" fill="none"/>
            <circle cx="2" cy="9" r="1.3" stroke="currentColor" strokeWidth="1" fill="none"/>
            <path d="M2 3.3v4.4M3.5 5.5h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </>
        )}
      </svg>
      {isCompeting ? t.fork_mode_competing : t.fork_mode_independent}
    </Pill>
  );
}

// ── variant TREE — branching visual at the top of the header ──────────────
// Replaces the previous horizontal chip strip. Each alternative is a row
// with classic ├── / └── connector lines so the relationships are visible
// at a glance. Tapping a row navigates to that variant; the current one is
// highlighted. For competing mode, rows are numbered with rank ordinals.
function VariantTabs({
  proposal, allProposals, theme, t, lang,
  onOpen, onAddAlternative, showAdd = true, ranked = false,
}) {
  const root = vozRootOf(proposal, allProposals);
  const rows = vozTreeRows(root.id, allProposals);
  const containerRef = React.useRef(null);
  const activeRef = React.useRef(null);

  // When the current variant changes (e.g. user taps a sibling), scroll the
  // active row into view so the highlighted row is always visible.
  React.useEffect(() => {
    const c = containerRef.current, a = activeRef.current;
    if (!c || !a) return;
    const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (ar.top < cr.top || ar.bottom > cr.bottom) {
      c.scrollTo({ top: c.scrollTop + (ar.top - cr.top) - 4, behavior: 'smooth' });
    }
  }, [proposal.id]);

  if (rows.length <= 1 && !showAdd) return null;

  // Cap the visible height — collapse to a scroller after ~5 rows so a deep
  // thread never hijacks the whole screen.
  const maxRows = 5;
  const collapses = rows.length > maxRows;

  return (
    <div style={{
      position: 'sticky', top: 62, zIndex: 8,
      background: theme.surface2,
      borderBottom: `0.5px solid ${theme.border}`,
      flexShrink: 0,
    }}>
      {/* eyebrow */}
      <div style={{
        padding: '10px 16px 4px',
        fontSize: 10, fontWeight: 600,
        color: theme.inkMute, letterSpacing: 0.08, textTransform: 'uppercase',
        fontFamily: '"Public Sans", sans-serif',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span>
          {ranked ? lang === 'pt' ? 'Árvore · decisão concorrente' : 'Tree · competing decision'
                  : lang === 'pt' ? 'Árvore de alternativas' : 'Alternative tree'}
        </span>
        <span style={{ color: theme.inkMute, fontWeight: 500 }}>
          {rows.length} {rows.length === 1 ? t.fork.toLowerCase() : t.variants.toLowerCase()}
        </span>
      </div>
      <div ref={containerRef} style={{
        padding: '2px 4px 6px',
        maxHeight: collapses ? maxRows * 30 + 12 : 'none',
        overflowY: collapses ? 'auto' : 'visible',
      }}>
        {rows.map((row, i) => (
          <VariantTreeRow key={row.proposal.id} row={row} idx={i}
            theme={theme} t={t} lang={lang} ranked={ranked}
            isCurrent={row.proposal.id === proposal.id}
            rowRef={row.proposal.id === proposal.id ? activeRef : undefined}
            onClick={() => onOpen(row.proposal.id)} />
        ))}
        {showAdd && (
          <button onClick={onAddAlternative} style={{
            appearance: 'none', cursor: 'pointer',
            width: '100%', textAlign: 'left',
            padding: '8px 10px 8px 12px',
            background: 'transparent', border: 'none',
            color: theme.inkSoft,
            fontFamily: '"Public Sans", sans-serif', fontSize: 12.5,
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.accent}10`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
              color: theme.borderHi, letterSpacing: 1,
            }}>{rows[rows.length - 1].depth > 0 ? '   ' : ''}+ </span>
            <span>{t.add_alt}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// One row in the tree. The branch prefix is laid out with monospace box-
// drawing characters so depths align cleanly without per-row SVG.
function VariantTreeRow({
  row, idx, theme, t, lang, ranked, isCurrent, onClick, rowRef,
}) {
  const p = row.proposal;
  const isRoot = !p.parentId;
  const y = p.votes.yes.length;
  const n = p.votes.no.length;
  const stateColor = (
    p.state === 'voting' ? theme.accent
    : p.state === 'passed' ? theme.yes
    : p.state === 'rejected' || p.state === 'quorum' ? theme.no
    : theme.inkMute
  );

  // Build the box-drawing prefix.
  let prefix = '';
  for (let c = 1; c < row.depth; c += 1) {
    prefix += row.ancestorLasts[c] ? '   ' : '│  ';
  }
  if (row.depth > 0) {
    prefix += row.isLast ? '└─ ' : '├─ ';
  }

  return (
    <button ref={rowRef} onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer',
      width: '100%', textAlign: 'left',
      padding: '6px 10px 6px 12px', borderRadius: 7,
      background: isCurrent ? theme.surface : 'transparent',
      border: `1px solid ${isCurrent ? theme.borderHi : 'transparent'}`,
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: '"Public Sans", sans-serif',
      boxShadow: isCurrent ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
    }}>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13, color: theme.borderHi,
        whiteSpace: 'pre', flexShrink: 0,
        lineHeight: 1, fontWeight: 400, letterSpacing: 0.5,
      }}>{prefix}</span>
      {/* node marker — rank number for competing, state dot otherwise */}
      {ranked ? (
        <span style={{
          fontFamily: '"Newsreader", serif', fontSize: 15,
          fontWeight: 500, color: theme.ink,
          minWidth: 14, textAlign: 'center', flexShrink: 0,
          fontVariationSettings: '"opsz" 18',
        }}>{idx + 1}</span>
      ) : (
        <span style={{
          width: 7, height: 7, borderRadius: 999,
          background: isCurrent ? stateColor : 'transparent',
          border: `1.5px solid ${stateColor}`,
          flexShrink: 0,
        }} />
      )}
      {/* title */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, fontWeight: isCurrent ? 600 : 500,
        color: isCurrent ? theme.ink : theme.ink,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        lineHeight: 1.3,
      }}>{p.title}</span>
      {/* trailing tally / state */}
      {!ranked && (y + n) > 0 && (
        <span style={{
          fontSize: 11, fontVariantNumeric: 'tabular-nums',
          color: theme.inkMute, flexShrink: 0,
          fontFamily: '"Public Sans", sans-serif',
        }}>
          <span style={{ color: theme.yes, fontWeight: 600 }}>{y}</span>
          <span style={{ color: theme.border, margin: '0 1px' }}>/</span>
          <span style={{ color: theme.no, fontWeight: 600 }}>{n}</span>
        </span>
      )}
    </button>
  );
}

// ── competing-mode decision panel (full page replacement) ─────────────────
// In competing mode the unit of decision is the whole tree. Voters submit a
// single ordering. The page presents the alternatives flat, with side-by-side
// vitals and a single submit. The current proposal's body still sits above
// (rendered by the screen) — this component owns the ranking interaction.
function CompetingDecision({
  proposal, allProposals, theme, t, lang, onOpen,
}) {
  const root = vozRootOf(proposal, allProposals);
  const flat = vozTreeFlat(root.id, allProposals);
  // Initial ordering = creation order. Stays local; "planned" stamp is honest.
  const [order, setOrder] = React.useState(() => flat.map((n) => n.proposal.id));
  const [excluded, setExcluded] = React.useState(false);
  React.useEffect(() => {
    // Keep order in sync if the tree changes underneath us (e.g. new alt).
    setOrder((prev) => {
      const ids = flat.map((n) => n.proposal.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat.length]);

  const move = (idx, dir) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= order.length) return;
    const next = [...order];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOrder(next);
  };

  return (
    <div>
      <div style={{
        padding: '12px 14px', background: theme.accentSoft,
        border: `1px solid ${theme.accent}55`, borderRadius: 10,
        marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
        fontFamily: '"Public Sans", sans-serif',
      }}>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: theme.accent, fontWeight: 600, letterSpacing: 1.5,
          padding: '2px 6px', border: `1px solid ${theme.accent}`,
          borderRadius: 4, textTransform: 'uppercase', flexShrink: 0,
        }}>{lang === 'pt' ? 'previsto' : 'planned'}</span>
        <div style={{ fontSize: 12.5, color: theme.inkSoft, lineHeight: 1.5 }}>
          {t.fork_mode_competing_hint} {t.fork_mode_planned}.
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {order.map((id, idx) => {
          const p = allProposals.find((x) => x.id === id);
          if (!p) return null;
          const isCurrent = p.id === proposal.id;
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'stretch', gap: 10,
              padding: 12,
              background: isCurrent ? `${theme.accent}10` : theme.surface,
              border: `1px solid ${isCurrent ? theme.accent + '55' : theme.border}`,
              borderRadius: 12,
            }}>
              <div style={{
                width: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Newsreader", serif', fontSize: 26,
                color: theme.ink, fontWeight: 500,
                fontVariationSettings: '"opsz" 36',
                fontVariantNumeric: 'tabular-nums',
              }}>{idx + 1}</div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => onOpen(p.id)}>
                <div style={{
                  fontFamily: '"Newsreader", serif', fontSize: 17,
                  fontWeight: 500, color: theme.ink, lineHeight: 1.25,
                  fontVariationSettings: '"opsz" 24',
                }}>{p.title}</div>
                <div style={{
                  fontSize: 11.5, color: theme.inkSoft, marginTop: 4,
                  fontFamily: '"Public Sans", sans-serif',
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                }}>
                  <span>{findUser(p.author).name}</span>
                  {!p.parentId && (
                    <>
                      <span style={{ color: theme.border }}>·</span>
                      <span style={{ color: theme.inkMute, fontWeight: 500 }}>{t.root_label.toLowerCase()}</span>
                    </>
                  )}
                  {isCurrent && (
                    <>
                      <span style={{ color: theme.border }}>·</span>
                      <span style={{ color: theme.accent, fontWeight: 600 }}>{lang === 'pt' ? 'lendo agora' : 'reading now'}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                <button onClick={() => move(idx, -1)} disabled={idx === 0}
                  aria-label="Rank higher"
                  style={rankArrowStyle(theme, idx === 0)}>
                  <svg width="11" height="7" viewBox="0 0 11 7" fill="none"><path d="M1 6l4.5-4.5L10 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1}
                  aria-label="Rank lower"
                  style={rankArrowStyle(theme, idx === order.length - 1)}>
                  <svg width="11" height="7" viewBox="0 0 11 7" fill="none"><path d="M1 1l4.5 4.5L10 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          );
        })}
        <button onClick={() => setExcluded(!excluded)} style={{
          appearance: 'none', cursor: 'pointer',
          padding: 12, marginTop: 4,
          background: excluded ? `${theme.accent}10` : 'transparent',
          border: `1px dashed ${excluded ? theme.accent + '88' : theme.border}`,
          borderRadius: 12, textAlign: 'left',
          fontFamily: '"Public Sans", sans-serif', display: 'flex',
          alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            border: `1.5px solid ${excluded ? theme.accent : theme.borderHi}`,
            background: excluded ? theme.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {excluded && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          <span style={{ fontSize: 13.5, color: theme.ink, fontWeight: 500 }}>{t.no_alternative}</span>
        </button>
      </div>
      <Button variant="primary" size="lg" block theme={theme}
        style={{ marginTop: 14 }} disabled>
        {t.rank_submit}
      </Button>
    </div>
  );
}

function rankArrowStyle(theme, disabled) {
  return {
    appearance: 'none', cursor: disabled ? 'default' : 'pointer',
    width: 28, height: 22, padding: 0,
    background: theme.surface2, border: `1px solid ${theme.border}`,
    borderRadius: 7, color: disabled ? theme.inkMute : theme.ink,
    opacity: disabled ? 0.35 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

Object.assign(window, {
  ForkModeBadge, VariantTabs, CompetingDecision,
});
