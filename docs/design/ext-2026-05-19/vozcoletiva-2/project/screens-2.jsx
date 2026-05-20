// screens-2.jsx — proposal detail, create, members, invite, join, you.

const { useState: useState2, useRef: useRef2 } = React;

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSAL DETAIL
// ═══════════════════════════════════════════════════════════════════════════
// Header for competing-mode proposal pages — leads with the ROOT question, not
// the individual variant. This is the "step back, look at the decision" framing
// the brief implies: in competing mode the unit of decision is the whole tree.
function CompetingHeader({ root, flat, theme, t, lang, timeLeft, isOpen }) {
  return (
    <div style={{
      padding: '18px 20px 14px',
      background: theme.surface2,
      borderBottom: `1px solid ${theme.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <Pill tone="accent" theme={theme} size="sm">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 2h6M1 5.5h4M1 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M8 8L10 6L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.fork_mode_competing}
        </Pill>
        {isOpen ? (
          <span style={{
            fontFamily: '"Public Sans", sans-serif', fontSize: 12,
            color: timeLeft < 86400000 ? theme.warn : theme.inkSoft, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {VozIcon.clock(timeLeft < 86400000 ? theme.warn : theme.inkSoft)}
            <span>{t.closes_in} {fmtTimeLeft(timeLeft, lang)}</span>
          </span>
        ) : null}
      </div>
      <div style={{
        fontSize: 10.5, color: theme.inkMute, fontWeight: 600,
        letterSpacing: 0.08, textTransform: 'uppercase',
        fontFamily: '"Public Sans", sans-serif',
        marginBottom: 4,
      }}>{t.deliberation_header}</div>
      <h2 style={{
        fontFamily: '"Newsreader", serif', fontWeight: 400, margin: 0,
        fontSize: 26, lineHeight: 1.15, color: theme.ink,
        letterSpacing: -0.3, textWrap: 'pretty',
        fontVariationSettings: '"opsz" 32',
      }}>{root.title}</h2>
      <div style={{
        marginTop: 8, fontSize: 12.5, color: theme.inkSoft,
        fontFamily: '"Public Sans", sans-serif',
      }}>
        {flat.length} {t.variants.toLowerCase()} · {lang === 'pt' ? 'ordene para decidir' : 'rank to decide'}
      </div>
    </div>
  );
}

function ProposalDetailScreen({
  theme, t, proposal, project, lang, tallyMode, voteStyle,
  allProposals,
  onBack, onVote, onRetract, onComment, onWithdraw, onFork, onOpenProposal,
}) {
  const author = findUser(proposal.author);
  const me = ME();
  const myVote = (
    proposal.votes.yes.includes(me.id) ? 'yes' :
    proposal.votes.no.includes(me.id) ? 'no' :
    proposal.votes.abstain.includes(me.id) ? 'abstain' : null
  );
  const [commentBody, setCommentBody] = useState2('');
  const isOpen = proposal.state === 'voting';
  const timeLeft = proposal.closesAt - VOZ_NOW;
  const tally = isOpen
    ? (tallyMode === 'hidden' && !myVote ? 'hidden' : 'visible')
    : 'visible';
  const root = vozRootOf(proposal, allProposals);
  const mode = root.forkMode || 'independent';
  const isCompeting = mode === 'competing';
  const isRoot = !proposal.parentId;
  const flat = vozTreeFlat(root.id, allProposals);
  const inThread = flat.length > 1;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t}
        title={isCompeting ? t.decision_header : (isOpen ? t.state_voting : t.proposals)}
        project={project} onBack={onBack} onMenu={() => {}} />

      {/* sticky variant tab strip — always shown for threads with >1 node,
          shown with just the +Add for solo proposals on open status. */}
      {(inThread || isOpen) && (
        <VariantTabs proposal={proposal} allProposals={allProposals}
          theme={theme} t={t} lang={lang} ranked={isCompeting}
          showAdd={isOpen}
          onOpen={onOpenProposal}
          onAddAlternative={() => onFork(proposal.id)} />
      )}

      {/* Competing mode pivot: lead with the question, not the variant */}
      {isCompeting && inThread ? (
        <CompetingHeader root={root} flat={flat} theme={theme} t={t}
          lang={lang} timeLeft={timeLeft} isOpen={isOpen} />
      ) : null}

      {/* Variant body block */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          flexWrap: 'wrap',
        }}>
          {!isCompeting && <StateBadge state={proposal.state} theme={theme} t={t} />}
          <Pill tone="neutral" theme={theme} size="sm">
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, letterSpacing: 1 }}>
              {proposal.rule === 'supermajority' ? '⅔' : '½+'}
            </span>
            {ruleLabel(proposal.rule, t)}
          </Pill>
          {proposal.quorum && (
            <Pill tone="neutral" theme={theme} size="sm">{t.quorum} {proposal.quorum}</Pill>
          )}
          {!isCompeting && inThread && <ForkModeBadge mode={mode} theme={theme} t={t} />}
        </div>
        <h1 style={{
          fontFamily: '"Newsreader", serif', fontWeight: 400, margin: 0,
          fontSize: isCompeting ? 22 : 28, lineHeight: 1.18, color: theme.ink,
          letterSpacing: -0.3, textWrap: 'pretty',
          fontVariationSettings: '"opsz" 32',
        }}>{proposal.title}</h1>
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: '"Public Sans", sans-serif', fontSize: 13, color: theme.inkSoft,
        }}>
          <Avatar user={author} size={22} />
          <span style={{ color: theme.ink, fontWeight: 500 }}>{author.name}</span>
          <span style={{ color: theme.border }}>·</span>
          <span>{fmtAgo(proposal.createdAt, lang)}</span>
          {isRoot && inThread && !isCompeting && (
            <>
              <span style={{ color: theme.border }}>·</span>
              <Pill tone="neutral" theme={theme} size="sm">{t.root_label}</Pill>
            </>
          )}
        </div>

        {/* closing strip — only when this variant has its own clock (independent) */}
        {!isCompeting && (
          <div style={{
            marginTop: 16, padding: '14px 16px',
            background: theme.surface,
            border: `0.5px solid ${theme.border}`,
            borderLeft: `3px solid ${isOpen ? theme.accent : theme.border}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            fontFamily: '"Public Sans", sans-serif',
            boxShadow: theme.shadowSm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {VozIcon.clock(theme.inkSoft)}
              <div style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                <span style={{ color: theme.inkSoft }}>{isOpen ? t.closes_in : t.closed} </span>
                <span style={{ color: theme.ink, fontWeight: 600 }}>
                  {isOpen ? fmtTimeLeft(timeLeft, lang) : fmtAgo(proposal.closesAt, lang)}
                </span>
              </div>
            </div>
            <span style={{
              fontSize: 11, color: theme.inkMute, fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {new Date(proposal.closesAt).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-GB',
                { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* body */}
        <div style={{ marginTop: 20 }}>
          {renderMD(proposal.body, theme)}
        </div>

        {/* withdraw, if author and open */}
        {isOpen && proposal.author === me.id && !isCompeting && (
          <div style={{ marginTop: 4 }}>
            <Button variant="danger" theme={theme} size="sm" onClick={onWithdraw}>
              {t.withdraw}
            </Button>
          </div>
        )}
      </div>

      {/* voting block — branches by mode */}
      <div style={{ padding: '0 16px 22px' }}>
        {isCompeting ? (
          <Card theme={theme} padded={false}>
            <div style={{ padding: 18 }}>
              <div style={{
                fontSize: 11, letterSpacing: 0.06, textTransform: 'uppercase',
                color: theme.inkSoft, fontWeight: 600,
                fontFamily: '"Public Sans", sans-serif', marginBottom: 14,
              }}>{isOpen ? t.rank_to_decide : t.final_tally}</div>
              <CompetingDecision proposal={proposal} allProposals={allProposals}
                theme={theme} t={t} lang={lang} onOpen={onOpenProposal} />
            </div>
          </Card>
        ) : (
          <Card theme={theme} padded={false}>
            <div style={{ padding: 18 }}>
              <div style={{
                fontSize: 11, letterSpacing: 0.06, textTransform: 'uppercase',
                color: theme.inkSoft, fontWeight: 600,
                fontFamily: '"Public Sans", sans-serif', marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{isOpen ? t.running_tally : t.final_tally}</span>
                {!isOpen && proposal.state === 'passed' && (
                  <span style={{ color: theme.yes, letterSpacing: 0.04 }}>✓ {t.state_passed}</span>
                )}
              </div>
              <TallyBar proposal={proposal} theme={theme} t={t} mode={tally} />
              {isOpen && (
                <div style={{
                  marginTop: 18, paddingTop: 16,
                  borderTop: `1px solid ${theme.border}`,
                }}>
                  <div style={{
                    fontSize: 11, letterSpacing: 0.06, textTransform: 'uppercase',
                    color: theme.inkSoft, fontWeight: 600,
                    fontFamily: '"Public Sans", sans-serif', marginBottom: 10,
                  }}>{t.your_vote}</div>
                  <VoteControl theme={theme} t={t} style={voteStyle}
                    myVote={myVote} onVote={onVote} onRetract={onRetract} />
                  {/* the disagreement → counter-proposal pathway, inline. */}
                  <button onClick={() => onFork(proposal.id)} style={{
                    appearance: 'none', cursor: 'pointer', marginTop: 14,
                    width: '100%', padding: '10px 12px',
                    background: 'transparent',
                    border: `1px dashed ${theme.borderHi}`, borderRadius: 10,
                    color: theme.ink,
                    fontFamily: '"Public Sans", sans-serif', fontSize: 13,
                    fontWeight: 500, letterSpacing: 0.01,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M3 2v6a3 3 0 003 3h4M9 8l2 3-3 2" stroke="currentColor"
                        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t.fork_verb}</span>
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* discussion */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          fontFamily: '"Newsreader", serif', fontSize: 22, fontWeight: 400,
          color: theme.ink, fontVariationSettings: '"opsz" 32',
          letterSpacing: -0.2,
        }}>{t.discussion}</div>
        <div style={{
          fontSize: 12, color: theme.inkMute, marginTop: 2,
          fontFamily: '"Public Sans", sans-serif',
        }}>
          {proposal.comments.length} {proposal.comments.length === 1 ? 'comment' : 'comments'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {proposal.comments.map(c => (
          <CommentRow key={c.id} comment={c} theme={theme} t={t} lang={lang} />
        ))}
        {proposal.comments.length === 0 && (
          <div style={{
            color: theme.inkMute, fontSize: 13, fontStyle: 'italic',
            fontFamily: '"Public Sans", sans-serif',
          }}>No comments yet. Be the first.</div>
        )}
        <CommentComposer theme={theme} t={t}
          value={commentBody} onChange={setCommentBody}
          onSubmit={() => { if (commentBody.trim()) { onComment(commentBody); setCommentBody(''); } }} />
      </div>
    </div>
  );
}

// ── vote control variants ──────────────────────────────────────────────────
function VoteControl({ theme, t, style, myVote, onVote, onRetract }) {
  if (style === 'segmented') {
    const opts = [
      { id: 'yes', label: t.yes, color: theme.yes },
      { id: 'abstain', label: t.abstain, color: theme.abstain },
      { id: 'no', label: t.no, color: theme.no },
    ];
    return (
      <>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          padding: 3, gap: 0, background: theme.surface2,
          border: `1px solid ${theme.border}`, borderRadius: 12, position: 'relative',
        }}>
          {opts.map(o => {
            const on = myVote === o.id;
            return (
              <button key={o.id} onClick={() => onVote(o.id)} style={{
                appearance: 'none', cursor: 'pointer',
                height: 42, border: 'none', borderRadius: 9,
                background: on ? theme.surface : 'transparent',
                color: on ? o.color : theme.inkSoft,
                fontFamily: '"Public Sans", sans-serif',
                fontWeight: on ? 600 : 500, fontSize: 14,
                boxShadow: on ? `0 1px 2px rgba(0,0,0,0.07), inset 0 0 0 1px ${theme.border}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {on && <span style={{ width: 6, height: 6, borderRadius: 999, background: o.color }} />}
                {o.label}
              </button>
            );
          })}
        </div>
        {myVote && (
          <button onClick={onRetract} style={{
            appearance: 'none', background: 'transparent', border: 'none',
            color: theme.inkMute, fontSize: 12, marginTop: 8, cursor: 'pointer',
            fontFamily: '"Public Sans", sans-serif',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>{t.retract}</button>
        )}
      </>
    );
  }
  // default 'big-primary': yes/no as big primary buttons, abstain as ghost
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Button variant={myVote === 'yes' ? 'yes' : 'secondary'} size="lg"
          theme={theme} onClick={() => onVote('yes')}>
          {myVote === 'yes' && VozIcon.check('#fff')}
          {t.yes}
        </Button>
        <Button variant={myVote === 'no' ? 'no' : 'secondary'} size="lg"
          theme={theme} onClick={() => onVote('no')}>
          {myVote === 'no' && VozIcon.check('#fff')}
          {t.no}
        </Button>
      </div>
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => onVote('abstain')} style={{
          appearance: 'none', background: 'transparent',
          border: 'none', padding: 6, cursor: 'pointer',
          fontFamily: '"Public Sans", sans-serif', fontSize: 13,
          color: myVote === 'abstain' ? theme.ink : theme.inkSoft,
          fontWeight: myVote === 'abstain' ? 600 : 500,
          textDecoration: 'underline', textUnderlineOffset: 4,
          textDecorationColor: myVote === 'abstain' ? theme.ink : theme.border,
        }}>
          {myVote === 'abstain' ? '✓ ' : ''}{t.abstain}
        </button>
        {myVote && (
          <button onClick={onRetract} style={{
            appearance: 'none', background: 'transparent', border: 'none',
            color: theme.inkMute, fontSize: 12, cursor: 'pointer',
            fontFamily: '"Public Sans", sans-serif',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>{t.retract}</button>
        )}
      </div>
    </div>
  );
}

// ── comment row ────────────────────────────────────────────────────────────
function CommentRow({ comment, theme, t, lang }) {
  const author = findUser(comment.author);
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar user={author} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          fontFamily: '"Public Sans", sans-serif',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.ink }}>
            {author.name}
          </span>
          <span style={{ fontSize: 11, color: theme.inkMute }}>
            {fmtAgo(comment.at, lang)}
          </span>
          {comment.edited && (
            <span style={{ fontSize: 11, color: theme.inkMute, fontStyle: 'italic' }}>
              · {t.edited}
            </span>
          )}
        </div>
        <div style={{
          marginTop: 4, fontFamily: '"Public Sans", sans-serif',
          fontSize: 14.5, lineHeight: 1.55, color: theme.ink,
          textWrap: 'pretty',
        }}>{comment.body}</div>
      </div>
    </div>
  );
}

function CommentComposer({ theme, t, value, onChange, onSubmit }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
      <Avatar user={ME()} size={32} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={t.write_comment} rows={2}
          style={{
            appearance: 'none', resize: 'vertical', width: '100%',
            boxSizing: 'border-box',
            background: theme.fieldBg, color: theme.ink,
            border: `1px solid ${theme.border}`, borderRadius: 10,
            padding: '10px 12px', outline: 'none',
            fontFamily: '"Public Sans", sans-serif', fontSize: 14,
            lineHeight: 1.5,
          }} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 11, color: theme.inkMute,
            fontFamily: '"JetBrains Mono", monospace', letterSpacing: 1,
          }}>MD · **bold** · *italic*</span>
          <Button variant={value.trim() ? 'primary' : 'secondary'} size="sm"
            theme={theme} onClick={onSubmit} disabled={!value.trim()}>
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE PROPOSAL
// ═══════════════════════════════════════════════════════════════════════════
function CreateProposalScreen({ theme, t, project, parent, lang, onBack, onPublish }) {
  const isFork = !!parent;
  const [title, setTitle] = useState2(isFork ? parent.title : '');
  const [body, setBody] = useState2(isFork ? parent.body : '');
  const [rule, setRule] = useState2(isFork ? parent.rule : 'majority');
  const [runtime, setRuntime] = useState2('3d');
  const [quorum, setQuorum] = useState2(isFork && parent.quorum ? String(parent.quorum) : '');
  // Root proposals choose how their fork tree is decided. Forks inherit.
  const [forkMode, setForkMode] = useState2('independent');
  const valid = title.trim().length > 4;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t} title={isFork ? t.fork_verb : t.create_title}
        project={project} onBack={onBack} />
      <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* forking-from banner */}
        {isFork && (
          <div style={{
            padding: '12px 14px',
            background: theme.accentSoft,
            border: `1px solid ${theme.accent}44`,
            borderRadius: 10,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            fontFamily: '"Public Sans", sans-serif',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
              <path d="M3 2v7a3 3 0 003 3h7M10 9l3 3-3 3" stroke={theme.accent}
                strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: theme.accent,
                letterSpacing: 0.06, textTransform: 'uppercase',
              }}>{t.forking_from}</div>
              <div style={{
                fontSize: 13.5, color: theme.ink, fontWeight: 500, marginTop: 2,
                lineHeight: 1.35,
              }}>{parent.title}</div>
              <div style={{
                fontSize: 11.5, color: theme.inkSoft, marginTop: 4,
              }}>
                {lang === 'pt'
                  ? 'Edite o texto e os parâmetros — a regra de decisão é herdada da original.'
                  : 'Edit the text and parameters — the decision mode is inherited from the original.'}
              </div>
            </div>
          </div>
        )}
        <Field theme={theme} label={t.field_title} value={title}
          onChange={setTitle}
          placeholder={t === VOZ_STR.pt ? 'Diga em uma frase...' : 'Say it in one sentence...'}
          autoFocus large />
        <Field theme={theme} label={t.field_body} value={body}
          onChange={setBody} rows={6}
          placeholder={t === VOZ_STR.pt
            ? 'Contexto, evidências, motivação. Markdown.'
            : 'Context, evidence, rationale. Markdown supported.'} />
        <div>
          <div style={{
            fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
            color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
            fontFamily: '"Public Sans", sans-serif',
          }}>{t.field_rule}</div>
          <SegRow theme={theme} value={rule} onChange={setRule}
            options={[
              { id: 'majority', label: t.rule_majority, sub: '½+' },
              { id: 'supermajority', label: t.rule_supermajority, sub: '⅔' },
            ]} />
        </div>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
            color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
            fontFamily: '"Public Sans", sans-serif',
          }}>{t.field_runtime}</div>
          <SegRow theme={theme} value={runtime} onChange={setRuntime}
            options={[
              { id: '24h', label: t.runtime_24h },
              { id: '3d',  label: t.runtime_3d },
              { id: '1w',  label: t.runtime_1w },
              { id: '2w',  label: t.runtime_2w },
            ]} columns={4} />
        </div>
        <Field theme={theme} label={t.field_quorum} value={quorum}
          onChange={setQuorum} type="number"
          placeholder={t === VOZ_STR.pt ? 'mínimo de votantes' : 'minimum voters'}
          hint={t === VOZ_STR.pt
            ? 'Sem quórum, o resultado vale com qualquer número de votos.'
            : 'Without a quorum, the result counts regardless of turnout.'} />
        {/* Decision mode (root proposals only — descendants inherit) */}
        {!isFork && (
          <ForkModePicker theme={theme} t={t} value={forkMode} onChange={setForkMode} />
        )}
        <Button variant="primary" size="lg" block theme={theme}
          disabled={!valid} onClick={() => onPublish({
            title, body, rule, runtime, quorum,
            parentId: isFork ? parent.id : null,
            forkMode: isFork ? null : forkMode,
          })}>
          {isFork ? t.publish_fork : t.publish}
        </Button>
      </div>
    </div>
  );
}

// Decision-mode picker for root proposals. Competing mode is "planned" so its
// option is labelled and disabled — clicking it switches the selection back to
// independent and shows a small explanatory note.
function ForkModePicker({ theme, t, value, onChange }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
        color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
        fontFamily: '"Public Sans", sans-serif',
      }}>{t.fork_mode}</div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
      }}>
        {[
          { id: 'independent', label: t.fork_mode_independent, hint: t.fork_mode_independent_hint },
          { id: 'competing',   label: t.fork_mode_competing,   hint: t.fork_mode_competing_hint, planned: true },
        ].map(o => {
          const on = value === o.id;
          return (
            <button key={o.id} onClick={() => onChange(o.id)} style={{
              appearance: 'none', cursor: 'pointer', textAlign: 'left',
              padding: 12,
              background: on ? theme.surface : theme.fieldBg,
              border: `1px solid ${on ? theme.ink : theme.border}`,
              borderRadius: 10,
              display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
              fontFamily: '"Public Sans", sans-serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 999,
                  border: `1.5px solid ${on ? theme.ink : theme.borderHi}`,
                  background: on ? theme.ink : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {on && <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.bg }} />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink }}>{o.label}</span>
              </div>
              {o.planned && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                  color: theme.accent, fontWeight: 600, letterSpacing: 1.2,
                  padding: '2px 5px', border: `1px solid ${theme.accent}`,
                  borderRadius: 4, textTransform: 'uppercase',
                }}>planned</span>
              )}
              <div style={{
                fontSize: 11.5, color: theme.inkSoft, lineHeight: 1.4,
              }}>{o.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegRow({ theme, value, onChange, options, columns }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${columns || options.length}, 1fr)`,
      gap: 6,
    }}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            appearance: 'none', cursor: 'pointer', minHeight: 52,
            background: on ? theme.surface : theme.fieldBg,
            border: `1px solid ${on ? theme.ink : theme.border}`,
            borderRadius: 10, color: theme.ink,
            fontFamily: '"Public Sans", sans-serif',
            fontWeight: on ? 600 : 500, fontSize: 13, padding: '8px 6px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
            textAlign: 'center',
          }}>
            {o.sub && <span style={{
              fontSize: 11, color: on ? theme.accent : theme.inkMute,
              fontFamily: '"JetBrains Mono", monospace', letterSpacing: 1,
            }}>{o.sub}</span>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERS
// ═══════════════════════════════════════════════════════════════════════════
function MembersScreen({ theme, t, project, onBack, onProjectClick }) {
  // Sample assignments: u1 Owner, u2 Admin, u3 Moderator, rest Members, u9-10 Observers
  const assignments = [
    { user: VOZ_USERS[0], role: 'owner' },
    { user: VOZ_USERS[1], role: 'admin' },
    { user: VOZ_USERS[2], role: 'moderator' },
    { user: VOZ_USERS[3], role: 'member' },
    { user: VOZ_USERS[4], role: 'member' },
    { user: VOZ_USERS[5], role: 'member' },
    { user: VOZ_USERS[6], role: 'member' },
    { user: VOZ_USERS[7], role: 'member' },
    { user: VOZ_USERS[8], role: 'observer' },
    { user: VOZ_USERS[9], role: 'observer' },
  ];
  const grouped = ['owner', 'admin', 'moderator', 'member', 'observer'].map(role => ({
    role, items: assignments.filter(a => a.role === role),
  })).filter(g => g.items.length);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t} title={t.tab_members}
        project={project} onBack={onBack} onProjectClick={onProjectClick} />
      <div style={{ padding: '16px 20px 4px' }}>
        <div style={{
          fontSize: 13, color: theme.inkSoft,
          fontFamily: '"Public Sans", sans-serif',
        }}>{project.members} {t === VOZ_STR.pt ? 'pessoas' : 'people'}</div>
      </div>
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {grouped.map(g => (
          <div key={g.role}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 0.06,
              color: theme.inkSoft, textTransform: 'uppercase',
              marginBottom: 8, padding: '0 4px',
              fontFamily: '"Public Sans", sans-serif',
            }}>{t['role_' + g.role]} · {g.items.length}</div>
            <Card theme={theme} padded={false}>
              {g.items.map((a, i) => (
                <div key={a.user.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`,
                }}>
                  <Avatar user={a.user} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: '"Public Sans", sans-serif', fontWeight: 500,
                      fontSize: 14.5, color: theme.ink,
                    }}>{a.user.name}{a.user.id === 'u1' && (
                      <span style={{ color: theme.inkMute, fontWeight: 400, fontSize: 12 }}> · you</span>
                    )}</div>
                  </div>
                  <span style={{ color: theme.inkMute }}>{VozIcon.dots(theme.inkMute)}</span>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE
// ═══════════════════════════════════════════════════════════════════════════
function InviteScreen({ theme, t, project, lang, onBack, onProjectClick }) {
  const [role, setRole] = useState2('member');
  const [expires, setExpires] = useState2('14d');
  const [maxUses, setMaxUses] = useState2('');
  const [note, setNote] = useState2('');
  const [created, setCreated] = useState2(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t} title={t.tab_invite}
        project={project} onBack={onBack} onProjectClick={onProjectClick} />

      {/* Created invitation card */}
      {created && (
        <div style={{ padding: '14px 16px 0' }}>
          <Card theme={theme} padded={false} style={{ borderColor: theme.accent }}>
            <div style={{ padding: 18 }}>
              <div style={{
                fontSize: 11, letterSpacing: 0.06, textTransform: 'uppercase',
                color: theme.accent, fontWeight: 600,
                fontFamily: '"Public Sans", sans-serif', marginBottom: 8,
              }}>Created · {t['role_' + created.role]}</div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 22, fontWeight: 500, color: theme.ink,
                letterSpacing: 4, padding: '8px 0',
              }}>{created.code}</div>
              <div style={{
                marginTop: 4, fontSize: 12, color: theme.inkSoft,
                fontFamily: '"Public Sans", sans-serif', wordBreak: 'break-all',
              }}>vozcoletiva.com/i/{created.code.replace('-', '').toLowerCase()}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button size="sm" theme={theme}>
                  {VozIcon.copy(theme.ink)} {t.invite_link}
                </Button>
                <Button size="sm" theme={theme}>
                  {VozIcon.copy(theme.ink)} {t.invite_code}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Active invitations */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.06,
          color: theme.inkSoft, textTransform: 'uppercase',
          marginBottom: 8, padding: '0 4px',
          fontFamily: '"Public Sans", sans-serif',
        }}>{t.invite_active}</div>
        <Card theme={theme} padded={false}>
          {VOZ_INVITES.map((inv, i) => (
            <div key={inv.id} style={{
              padding: '14px', display: 'flex', alignItems: 'center', gap: 14,
              borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 14,
                  fontWeight: 500, color: theme.ink, letterSpacing: 2,
                }}>{inv.code}</div>
                <div style={{
                  marginTop: 4, fontSize: 12, color: theme.inkSoft,
                  fontFamily: '"Public Sans", sans-serif',
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                }}>
                  <span>{t['role_' + inv.role]}</span>
                  <span style={{ color: theme.border }}>·</span>
                  <span>
                    {inv.uses}/{inv.maxUses || '∞'} {t === VOZ_STR.pt ? 'usos' : 'used'}
                  </span>
                  <span style={{ color: theme.border }}>·</span>
                  <span>
                    {inv.expiresAt
                      ? (lang === 'pt' ? 'expira ' : 'expires ') + fmtTimeLeft(inv.expiresAt - VOZ_NOW, lang)
                      : t.no_expiry}
                  </span>
                </div>
                {inv.note && (
                  <div style={{
                    marginTop: 4, fontSize: 12, color: theme.inkMute,
                    fontFamily: '"Public Sans", sans-serif', fontStyle: 'italic',
                  }}>"{inv.note}"</div>
                )}
              </div>
              <Button size="sm" variant="danger" theme={theme}>{t.invite_revoke}</Button>
            </div>
          ))}
        </Card>
      </div>

      {/* Create form */}
      <div style={{ padding: '20px 16px 24px' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.06,
          color: theme.inkSoft, textTransform: 'uppercase',
          marginBottom: 10, padding: '0 4px',
          fontFamily: '"Public Sans", sans-serif',
        }}>{t.invite_title}</div>
        <Card theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
                color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
                fontFamily: '"Public Sans", sans-serif',
              }}>{t.invite_role}</div>
              <SegRow theme={theme} value={role} onChange={setRole}
                options={[
                  { id: 'member',    label: t.role_member },
                  { id: 'moderator', label: t.role_moderator },
                  { id: 'observer',  label: t.role_observer },
                ]} />
            </div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
                color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
                fontFamily: '"Public Sans", sans-serif',
              }}>{t.invite_expiry}</div>
              <SegRow theme={theme} value={expires} onChange={setExpires}
                options={[
                  { id: '7d',   label: '7d' },
                  { id: '14d',  label: '14d' },
                  { id: '30d',  label: '30d' },
                  { id: 'none', label: t.no_expiry },
                ]} columns={4} />
            </div>
            <Field theme={theme} label={t.invite_uses} value={maxUses}
              onChange={setMaxUses} type="number"
              placeholder={t.no_uses_limit} />
            <Field theme={theme} label={t.invite_note} value={note}
              onChange={setNote} placeholder={t === VOZ_STR.pt ? 'p.ex. "para os novos inquilinos"' : 'e.g. "for new tenants"'} />
            <Button variant="primary" size="lg" block theme={theme}
              onClick={() => {
                const code = Math.random().toString(36).toUpperCase().slice(2, 6) + '-' +
                             Math.random().toString(36).toUpperCase().slice(2, 6);
                setCreated({ code, role });
              }}>
              {t.invite_create}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOIN VIA CODE
// ═══════════════════════════════════════════════════════════════════════════
function JoinScreen({ theme, t, onBack, onJoined }) {
  const [code, setCode] = useState2('');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t} title={t.join_title} onBack={onBack} />
      <div style={{ padding: '32px 22px' }}>
        <div style={{
          fontFamily: '"Newsreader", serif', fontSize: 22, fontWeight: 400,
          color: theme.ink, fontStyle: 'italic', lineHeight: 1.3,
          fontVariationSettings: '"opsz" 36',
        }}>{t.join_sub}</div>
        <div style={{ marginTop: 28 }}>
          <Field theme={theme} value={code}
            onChange={(v) => setCode(v.toUpperCase())} mono large
            placeholder="XXXX-XXXX" />
        </div>
        <div style={{ marginTop: 18 }}>
          <Button variant="primary" size="lg" block theme={theme}
            disabled={code.replace('-', '').length < 8} onClick={onJoined}>
            {t.signIn === 'Sign in' ? 'Join project' : 'Entrar no projeto'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// YOU / PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
function YouScreen({ theme, t, themePref, setThemePref, lang, setLang, onSignOut, onBack, avatarUrl, setAvatarUrl }) {
  const me = ME();
  const fileRef = useRef2(null);
  const cameraRef = useRef2(null);
  const readAsDataUrl = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
      <TopBar theme={theme} t={t} title={t.settings} onBack={onBack} />
      <div style={{ padding: '24px 20px 14px', textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Avatar user={me} size={84} ring={theme.surface} />
          {/* edit-photo badge over the avatar */}
          <button onClick={() => fileRef.current?.click()}
            aria-label={lang === 'pt' ? 'Mudar foto' : 'Change photo'}
            style={{
              appearance: 'none', cursor: 'pointer',
              position: 'absolute', right: -4, bottom: -4,
              width: 30, height: 30, borderRadius: 999,
              background: theme.ink, color: theme.bg,
              border: `2px solid ${theme.bg}`, padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 11.5h2.5l6-6L8 3l-6 6V11.5zM9 4L11 6" stroke="currentColor"
                strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div style={{
          marginTop: 12, fontFamily: '"Newsreader", serif',
          fontSize: 26, fontWeight: 400, color: theme.ink, letterSpacing: -0.3,
          fontVariationSettings: '"opsz" 36',
        }}>{me.name}</div>
        <div style={{
          marginTop: 2, fontSize: 13, color: theme.inkSoft,
          fontFamily: '"Public Sans", sans-serif',
        }}>marina@example.com</div>
        {/* photo actions */}
        <div style={{
          marginTop: 14, display: 'inline-flex', gap: 8,
        }}>
          <Button size="sm" theme={theme} onClick={() => cameraRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="3" width="11" height="8" rx="1.5" stroke={theme.ink} strokeWidth="1.4"/>
              <circle cx="6.5" cy="7" r="2" stroke={theme.ink} strokeWidth="1.4"/>
              <path d="M5 3l1-1h1l1 1" stroke={theme.ink} strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            {lang === 'pt' ? 'Tirar foto' : 'Take photo'}
          </Button>
          <Button size="sm" theme={theme} onClick={() => fileRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 9V3a1 1 0 011-1h7a1 1 0 011 1v6M2 9l2.5-2.5L7 9l2-2 2 2M2 9v1a1 1 0 001 1h7a1 1 0 001-1V9" stroke={theme.ink} strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            {lang === 'pt' ? 'Carregar' : 'Upload'}
          </Button>
          {avatarUrl && (
            <Button size="sm" variant="ghost" theme={theme}
              onClick={() => setAvatarUrl(null)}>
              {lang === 'pt' ? 'Remover' : 'Remove'}
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*"
          onChange={(e) => readAsDataUrl(e.target.files?.[0])}
          style={{ display: 'none' }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="user"
          onChange={(e) => readAsDataUrl(e.target.files?.[0])}
          style={{ display: 'none' }} />
      </div>

      <PrefBlock theme={theme} label={t.settings}>
        <PrefRow theme={theme} label={t.theme}>
          <SegRow theme={theme} value={themePref} onChange={setThemePref}
            options={[
              { id: 'system', label: t.theme_system },
              { id: 'light',  label: t.theme_light },
              { id: 'dark',   label: t.theme_dark },
            ]} />
        </PrefRow>
        <PrefRow theme={theme} label={t.language}>
          <SegRow theme={theme} value={lang} onChange={setLang}
            options={[
              { id: 'en', label: 'English' },
              { id: 'pt', label: 'Português' },
            ]} />
        </PrefRow>
      </PrefBlock>

      <PrefBlock theme={theme} label={t === VOZ_STR.pt ? 'Notificações' : 'Notifications'}>
        <PrefStatic theme={theme} label={t === VOZ_STR.pt ? 'Caixa de entrada (em breve)' : 'Inbox (coming soon)'}
          value={t === VOZ_STR.pt ? 'Atividade entre projetos' : 'Cross-project activity'} muted />
        <PrefStatic theme={theme} label={t === VOZ_STR.pt ? 'Notificações push' : 'Push notifications'}
          value={t === VOZ_STR.pt ? 'em breve' : 'coming soon'} muted />
      </PrefBlock>

      <div style={{ padding: '24px 20px 32px' }}>
        <Button block theme={theme} variant="ghost" onClick={onSignOut}>
          {t.sign_out}
        </Button>
        <div style={{
          marginTop: 20, textAlign: 'center', fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, color: theme.inkMute, letterSpacing: 2,
          textTransform: 'uppercase',
        }}>vozcoletiva v0.1 · open source</div>
      </div>
    </div>
  );
}

function PrefBlock({ theme, label, children }) {
  return (
    <div style={{ padding: '8px 16px' }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 0.06,
        color: theme.inkSoft, textTransform: 'uppercase',
        marginBottom: 8, padding: '0 4px',
        fontFamily: '"Public Sans", sans-serif',
      }}>{label}</div>
      <Card theme={theme} padded={false}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>
      </Card>
    </div>
  );
}

function PrefRow({ theme, label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
        color: theme.inkSoft, textTransform: 'uppercase', marginBottom: 8,
        fontFamily: '"Public Sans", sans-serif',
      }}>{label}</div>
      {children}
    </div>
  );
}

function PrefStatic({ theme, label, value, muted }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontFamily: '"Public Sans", sans-serif',
    }}>
      <span style={{ fontSize: 14, color: muted ? theme.inkMute : theme.ink }}>{label}</span>
      <span style={{ fontSize: 13, color: theme.inkMute }}>{value}</span>
    </div>
  );
}

Object.assign(window, {
  ProposalDetailScreen, CreateProposalScreen, MembersScreen,
  InviteScreen, JoinScreen, YouScreen, SegRow,
});
