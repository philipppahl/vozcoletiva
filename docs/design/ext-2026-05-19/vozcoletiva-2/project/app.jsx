// app.jsx — main app, routing, state, tweaks.

const VOZ_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "indigo",
  "density": "regular",
  "lang": "en",
  "tallyMode": "visible",
  "voteStyle": "big-primary",
  "showScreensRail": true,
  "avatarUrl": null
}/*EDITMODE-END*/;

function App() {
  const [tw, setTw] = useTweaks(VOZ_TWEAK_DEFAULTS);
  // Avatar component reads ME's photo from a window global so we don't have
  // to prop-drill through every place an Avatar appears. Keep them in sync.
  window.VOZ_ME_AVATAR_URL = tw.avatarUrl || null;
  const theme = vozTheme(tw.dark, tw.accent);
  const t = VOZ_STR[tw.lang] || VOZ_STR.en;
  const lang = tw.lang;

  // auth
  const [authMode, setAuthMode] = React.useState('signin');
  const [authStep, setAuthStep] = React.useState('app'); // 'auth' | 'verify' | 'app'

  // nav
  //   route.name ∈ projects-list | join | project-home | proposal-detail |
  //                compose | members | invite | preferences
  //   tab ∈ proposals | documents | messages | search (only on project-home)
  const [route, setRoute] = React.useState({ name: 'project-home', projectId: 'vmc' });
  const [tab, setTab] = React.useState('proposals');
  const [filter, setFilter] = React.useState('voting');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // Close the sheet whenever the route or tab changes — otherwise it lingers
  // after navigating via the designer rail or another action.
  React.useEffect(() => { setSheetOpen(false); }, [route.name, route.projectId, route.proposalId, tab]);

  // data
  const [proposals, setProposals] = React.useState(VOZ_PROPOSALS);
  const currentProject = VOZ_PROJECTS.find(p => p.id === (route.projectId || 'vmc')) || VOZ_PROJECTS[0];
  const projectProposals = proposals.filter(p => p.projectId === currentProject.id);
  const currentProposal = route.proposalId ? proposals.find(p => p.id === route.proposalId) : null;

  // ── actions ──────────────────────────────────────────────────────────────
  const castVote = (proposalId, vote) => {
    setProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p;
      const me = ME().id;
      const v = {
        yes: p.votes.yes.filter(x => x !== me),
        no: p.votes.no.filter(x => x !== me),
        abstain: p.votes.abstain.filter(x => x !== me),
      };
      v[vote].push(me);
      return { ...p, votes: v };
    }));
  };
  const retractVote = (proposalId) => {
    setProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p;
      const me = ME().id;
      return {
        ...p,
        votes: {
          yes: p.votes.yes.filter(x => x !== me),
          no: p.votes.no.filter(x => x !== me),
          abstain: p.votes.abstain.filter(x => x !== me),
        },
      };
    }));
  };
  const addComment = (proposalId, body) => {
    setProposals(prev => prev.map(p => p.id !== proposalId ? p : ({
      ...p,
      comments: [...p.comments, {
        id: 'c-new-' + Date.now(), author: ME().id, body, at: Date.now(),
      }],
    })));
  };
  const withdraw = (proposalId) => {
    if (!window.confirm(t.confirm_withdraw)) return;
    setProposals(prev => prev.map(p => p.id !== proposalId ? p : ({ ...p, state: 'withdrawn' })));
    setRoute({ name: 'project-home', projectId: currentProject.id });
  };
  const publishProposal = (data) => {
    const runtimeMs = {
      '24h': 86400000, '3d': 3 * 86400000, '1w': 7 * 86400000, '2w': 14 * 86400000,
    }[data.runtime] || 3 * 86400000;
    const id = 'p-new-' + Date.now();
    setProposals(prev => [{
      id, projectId: currentProject.id,
      parentId: data.parentId || null,
      forkMode: data.parentId ? null : (data.forkMode || 'independent'),
      title: data.title, body: data.body || '',
      author: ME().id, rule: data.rule, runtime: runtimeMs,
      quorum: data.quorum ? Number(data.quorum) : null,
      state: 'voting', createdAt: Date.now(), closesAt: Date.now() + runtimeMs,
      votes: { yes: [], no: [], abstain: [] }, comments: [],
    }, ...prev]);
    setRoute({ name: 'proposal-detail', projectId: currentProject.id, proposalId: id });
    setTab('proposals');
  };

  // nav helpers — the new header rewires these:
  //   onAvatarClick  → personal preferences screen
  //   onProjectClick → project selector sheet
  const goToPreferences = () => setRoute({ name: 'preferences', projectId: currentProject.id });
  const openProjectSheet = () => setSheetOpen(true);
  const goBackToHome = () => setRoute({ name: 'project-home', projectId: currentProject.id });

  // ── render ───────────────────────────────────────────────────────────────
  const screen = (() => {
    if (authStep === 'auth') {
      return <AuthScreen theme={theme} t={t}
        mode={authMode} setMode={setAuthMode}
        onAuth={(m) => m === 'signup' ? setAuthStep('verify') : setAuthStep('app')} />;
    }
    if (authStep === 'verify') {
      return <VerifyScreen theme={theme} t={t} email="marina@example.com"
        onBack={() => setAuthStep('auth')} onVerify={() => setAuthStep('app')} />;
    }
    if (route.name === 'projects-list') {
      return <ProjectsScreen theme={theme} t={t}
        onPick={(id) => setRoute({ name: 'project-home', projectId: id })}
        onCreate={() => alert('New project flow (placeholder)')}
        onJoin={() => setRoute({ name: 'join' })} />;
    }
    if (route.name === 'join') {
      return <JoinScreen theme={theme} t={t}
        onBack={() => setRoute({ name: 'projects-list' })}
        onJoined={() => setRoute({ name: 'project-home', projectId: 'vmc' })} />;
    }
    if (route.name === 'proposal-detail' && currentProposal) {
      return <ProposalDetailScreen theme={theme} t={t} lang={lang}
        proposal={currentProposal} project={currentProject}
        allProposals={proposals}
        tallyMode={tw.tallyMode} voteStyle={tw.voteStyle}
        onBack={goBackToHome}
        onOpenProposal={(id) => setRoute({ name: 'proposal-detail', projectId: currentProject.id, proposalId: id })}
        onFork={(id) => setRoute({ name: 'compose', projectId: currentProject.id, parentId: id })}
        onVote={(v) => castVote(currentProposal.id, v)}
        onRetract={() => retractVote(currentProposal.id)}
        onComment={(b) => addComment(currentProposal.id, b)}
        onWithdraw={() => withdraw(currentProposal.id)} />;
    }
    if (route.name === 'compose') {
      const parent = route.parentId ? proposals.find(p => p.id === route.parentId) : null;
      return <CreateProposalScreen theme={theme} t={t} project={currentProject}
        parent={parent} lang={lang}
        onBack={() => setRoute(parent
          ? { name: 'proposal-detail', projectId: currentProject.id, proposalId: parent.id }
          : { name: 'project-home', projectId: currentProject.id })}
        onPublish={publishProposal} />;
    }
    if (route.name === 'members') {
      return <MembersScreen theme={theme} t={t} project={currentProject}
        onBack={goBackToHome} onProjectClick={openProjectSheet} />;
    }
    if (route.name === 'invite') {
      return <InviteScreen theme={theme} t={t} project={currentProject} lang={lang}
        onBack={goBackToHome} onProjectClick={openProjectSheet} />;
    }
    if (route.name === 'preferences') {
      return <YouScreen theme={theme} t={t}
        themePref={tw.dark ? 'dark' : 'light'}
        setThemePref={(v) => setTw('dark', v === 'dark')}
        lang={lang} setLang={(v) => setTw('lang', v)}
        avatarUrl={tw.avatarUrl}
        setAvatarUrl={(v) => setTw('avatarUrl', v)}
        onBack={goBackToHome}
        onSignOut={() => setAuthStep('auth')} />;
    }

    // project-home: tab-driven content area, with persistent ProjectHeader
    const tabContent = (() => {
      if (tab === 'documents') {
        return <DocumentsScreen theme={theme} t={t} lang={lang} />;
      }
      if (tab === 'messages') {
        return <MessagesScreen theme={theme} t={t} lang={lang} />;
      }
      if (tab === 'search') {
        return <SearchScreen theme={theme} t={t} lang={lang}
          proposals={projectProposals} project={currentProject}
          onOpenProposal={(id) => setRoute({ name: 'proposal-detail', projectId: currentProject.id, proposalId: id })} />;
      }
      // default = proposals
      return <ProjectHomeScreen theme={theme} t={t}
        project={currentProject} proposals={projectProposals}
        filter={filter} setFilter={setFilter}
        onOpen={(id) => setRoute({ name: 'proposal-detail', projectId: currentProject.id, proposalId: id })}
        onCompose={() => setRoute({ name: 'compose', projectId: currentProject.id })}
        onAvatarClick={goToPreferences} onProjectClick={openProjectSheet} />;
    })();

    if (tab === 'proposals') {
      // ProjectHomeScreen renders its own ProjectHeader. Render directly.
      return tabContent;
    }
    // Other tabs: wrap in ProjectHeader.
    const pageTitle = tab === 'documents' ? t.tab_documents
      : tab === 'messages' ? t.tab_messages
      : tab === 'search' ? t.tab_search
      : t.proposals;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: theme.bg }}>
        <ProjectHeader theme={theme} t={t} project={currentProject}
          pageTitle={pageTitle}
          onAvatarClick={goToPreferences}
          onProjectClick={openProjectSheet} />
        <div style={{ paddingTop: 16 }}>{tabContent}</div>
      </div>
    );
  })();

  const showTabBar = authStep === 'app' &&
    route.name === 'project-home';

  // ── render frame ─────────────────────────────────────────────────────────
  return (
    <>
      <ScreensRail tw={tw} setTw={setTw}
        route={route} setRoute={setRoute}
        tab={tab} setTab={setTab}
        authStep={authStep} setAuthStep={setAuthStep}
        theme={theme} />
      <Stage theme={theme}>
        <PhoneShell theme={theme} dark={tw.dark}>
          <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', background: theme.bg, color: theme.ink,
            fontFamily: '"Public Sans", system-ui, sans-serif',
            position: 'relative',
          }}>
            <StatusBarPlaceholder dark={tw.dark} theme={theme} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {screen}
            </div>
            {showTabBar && (
              <TabBar theme={theme} t={t} current={tab}
                onChange={(newTab) => {
                  setTab(newTab);
                  if (route.name !== 'project-home') {
                    setRoute({ name: 'project-home', projectId: currentProject.id });
                  }
                }} />
            )}
            <HomeIndicator theme={theme} dark={tw.dark} />
            {/* The project sheet lives inside the phone surface so its backdrop
                covers the phone, not the whole screen. */}
            <ProjectSelectorSheet
              theme={theme} t={t} lang={lang}
              project={currentProject} projects={VOZ_PROJECTS}
              open={sheetOpen} onClose={() => setSheetOpen(false)}
              onPickProject={(id) => { setRoute({ name: 'project-home', projectId: id }); setTab('proposals'); }}
              onCreateProject={() => alert('New project (placeholder)')}
              onJoinProject={() => setRoute({ name: 'join' })}
              onOpenMembers={() => setRoute({ name: 'members', projectId: currentProject.id })}
              onOpenInvite={() => setRoute({ name: 'invite', projectId: currentProject.id })} />
          </div>
        </PhoneShell>
      </Stage>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakToggle label="Dark" value={tw.dark}
            onChange={(v) => setTw('dark', v)} />
          <AccentTweak tw={tw} setTw={setTw} />
        </TweakSection>
        <TweakSection label="Layout & density">
          <TweakRadio label="Density" value={tw.density}
            options={['compact', 'regular', 'comfy']}
            onChange={(v) => setTw('density', v)} />
        </TweakSection>
        <TweakSection label="Voting">
          <TweakRadio label="Vote control" value={tw.voteStyle}
            options={[
              { value: 'big-primary', label: 'Buttons' },
              { value: 'segmented',   label: 'Segment' },
            ]}
            onChange={(v) => setTw('voteStyle', v)} />
          <TweakRadio label="Tally" value={tw.tallyMode}
            options={[
              { value: 'visible', label: 'Visible' },
              { value: 'hidden',  label: 'Hide until I vote' },
            ]}
            onChange={(v) => setTw('tallyMode', v)} />
        </TweakSection>
        <TweakSection label="Locale">
          <TweakRadio label="Language" value={tw.lang}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'pt', label: 'PT' },
            ]}
            onChange={(v) => setTw('lang', v)} />
        </TweakSection>
        <TweakSection label="Designer rail">
          <TweakToggle label="Show screen rail" value={tw.showScreensRail}
            onChange={(v) => setTw('showScreensRail', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ── accent picker — reads from VOZ_ACCENTS so it stays in sync ────────────
function AccentTweak({ tw, setTw }) {
  const accents = Object.entries(VOZ_ACCENTS).map(([key, a]) => ({
    key, color: `oklch(0.55 ${a.c} ${a.h})`,
  }));
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Accent</span></div>
      <div className="twk-chips">
        {accents.map(a => {
          const on = tw.accent === a.key;
          return (
            <button key={a.key} type="button" className="twk-chip" data-on={on ? '1' : '0'}
              style={{ background: a.color }} onClick={() => setTw('accent', a.key)}>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── phone shell + stage ────────────────────────────────────────────────────
function Stage({ children, theme }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'grid',
      placeItems: 'center', background: '#1a1a1a',
      padding: '40px 0',
      backgroundImage: `
        radial-gradient(1200px 600px at 30% 0%, rgba(255,255,255,0.04), transparent 60%),
        radial-gradient(1000px 500px at 70% 100%, rgba(255,255,255,0.025), transparent 60%)
      `,
    }}>
      {children}
    </div>
  );
}

function PhoneShell({ children, theme, dark }) {
  return (
    <div style={{
      width: 390, height: 822, borderRadius: 52,
      background: dark ? '#000' : '#0a0a0a',
      padding: 10, boxSizing: 'border-box',
      boxShadow: '0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 42, overflow: 'hidden',
        background: theme.bg, position: 'relative',
      }}>
        {children}
      </div>
    </div>
  );
}

function StatusBarPlaceholder({ dark, theme }) {
  return (
    <div style={{
      height: 50, flexShrink: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', position: 'relative', zIndex: 5,
      background: theme.bg,
    }}>
      <span style={{
        fontFamily: '"Public Sans", "SF Pro", system-ui, sans-serif',
        fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.2,
      }}>15:30</span>
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        width: 110, height: 32, borderRadius: 22, background: '#000',
      }} />
      <div style={{
        display: 'flex', gap: 5, alignItems: 'center', color: theme.ink,
      }}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          {[3,5,7,11].map((h, i) => (
            <rect key={i} x={i * 3.5} y={11 - h} width="2.5" height={h}
              rx="0.6" fill={theme.ink}/>
          ))}
        </svg>
        <svg width="25" height="11" viewBox="0 0 25 11">
          <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke={theme.ink}
            strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="19" height="7" rx="1.5" fill={theme.ink}/>
          <rect x="23" y="3.5" width="1.5" height="4" rx="0.5" fill={theme.ink} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

function HomeIndicator({ theme, dark }) {
  return (
    <div style={{
      height: 28, flexShrink: 0, display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
      paddingBottom: 8, pointerEvents: 'none', background: theme.surface,
    }}>
      <div style={{
        width: 134, height: 5, borderRadius: 100,
        background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
      }} />
    </div>
  );
}

// ── screens rail (designer-only) ──────────────────────────────────────────
function ScreensRail({ tw, setTw, route, setRoute, tab, setTab, authStep, setAuthStep, theme }) {
  if (!tw.showScreensRail) return null;
  const go = (r, newTab) => () => {
    setAuthStep('app'); setRoute(r); if (newTab) setTab(newTab);
  };
  const items = [
    { id: 'auth-signin',  label: 'Sign in',         on: () => setAuthStep('auth') },
    { id: 'auth-verify',  label: '6-digit verify',  on: () => setAuthStep('verify') },
    { id: 'projects',     label: 'Your projects',   on: go({ name: 'projects-list' }) },
    { id: 'join',         label: 'Join via code',   on: go({ name: 'join' }) },
    { id: 'home',         label: 'Project · proposals', on: go({ name: 'project-home', projectId: 'vmc' }, 'proposals') },
    { id: 'documents',    label: '· documents tab',     on: go({ name: 'project-home', projectId: 'vmc' }, 'documents') },
    { id: 'messages',     label: '· messages tab',      on: go({ name: 'project-home', projectId: 'vmc' }, 'messages') },
    { id: 'search',       label: '· search tab',        on: go({ name: 'project-home', projectId: 'vmc' }, 'search') },
    { id: 'detail-open',  label: 'Inside a thread (root)',  on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p1' }) },
    { id: 'detail-tight', label: 'Solo proposal · 2/3',     on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p2' }) },
    { id: 'detail-passed',label: 'Solo proposal · passed',  on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p4' }) },
    { id: 'detail-rej',   label: 'Solo proposal · rejected',on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p5' }) },
    { id: 'detail-fork',  label: 'Inside a thread (alt)',   on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p1f1' }) },
    { id: 'detail-comp',  label: 'Competing decision',      on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p3' }) },
    { id: 'detail-comp2', label: 'Competing · view alt',    on: go({ name: 'proposal-detail', projectId: 'vmc', proposalId: 'p3f2' }) },
    { id: 'compose',      label: 'New proposal',            on: go({ name: 'compose', projectId: 'vmc' }) },
    { id: 'compose-fork', label: 'Propose an alternative',  on: go({ name: 'compose', projectId: 'vmc', parentId: 'p1' }) },
    { id: 'members',      label: 'Members (from sheet)',    on: go({ name: 'members', projectId: 'vmc' }) },
    { id: 'invite',       label: 'Invite (from sheet)',     on: go({ name: 'invite', projectId: 'vmc' }) },
    { id: 'preferences',  label: 'Preferences (avatar)',    on: go({ name: 'preferences', projectId: 'vmc' }) },
  ];
  const activeId = (() => {
    if (authStep === 'auth') return 'auth-signin';
    if (authStep === 'verify') return 'auth-verify';
    if (route.name === 'projects-list') return 'projects';
    if (route.name === 'join') return 'join';
    if (route.name === 'compose') return route.parentId ? 'compose-fork' : 'compose';
    if (route.name === 'proposal-detail') {
      return ({
        p1: 'detail-open', p2: 'detail-tight',
        p3: 'detail-comp', p3f2: 'detail-comp2',
        p4: 'detail-passed', p5: 'detail-rej',
        p1f1: 'detail-fork',
      })[route.proposalId] || 'detail-open';
    }
    if (route.name === 'members') return 'members';
    if (route.name === 'invite') return 'invite';
    if (route.name === 'preferences') return 'preferences';
    if (tab === 'documents') return 'documents';
    if (tab === 'messages') return 'messages';
    if (tab === 'search') return 'search';
    return 'home';
  })();

  return (
    <div style={{
      position: 'fixed', top: 20, left: 20, zIndex: 100,
      width: 230, maxHeight: 'calc(100vh - 40px)',
      background: 'rgba(20,20,20,0.86)',
      backdropFilter: 'blur(12px) saturate(160%)',
      WebkitBackdropFilter: 'blur(12px) saturate(160%)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 8,
      fontFamily: '"Public Sans", system-ui, sans-serif',
      color: 'rgba(255,255,255,0.85)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      <div style={{
        padding: '8px 10px 6px', fontSize: 10, letterSpacing: 0.08,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
        fontWeight: 600,
      }}>Screens · {items.length}</div>
      {items.map(it => {
        const on = it.id === activeId;
        return (
          <button key={it.id} onClick={it.on} style={{
            appearance: 'none', display: 'flex', alignItems: 'center', gap: 8,
            background: on ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: 'none', color: on ? '#fff' : 'rgba(255,255,255,0.7)',
            fontFamily: 'inherit', fontSize: 12,
            fontWeight: on ? 600 : 500,
            padding: '7px 10px', width: '100%', borderRadius: 7,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: 999,
              background: on ? theme.accent : 'rgba(255,255,255,0.2)',
              flexShrink: 0,
            }} />
            <span style={{
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0, flex: 1,
            }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
