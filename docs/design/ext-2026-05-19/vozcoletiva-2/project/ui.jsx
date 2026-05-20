// ui.jsx — reusable atoms. Every styles object is namespaced (uiStyles…).

// ── brand mark + wordmark ──────────────────────────────────────────────────
function VozMark({ size = 28, color = 'currentColor', accent }) {
  // Open ring with a vote-dot inside — placeholder until the real logo-mark.svg
  // ships in /brand/. Geometry is deliberately simple.
  const stroke = Math.max(1.5, size * 0.07);
  const r = size / 2 - stroke / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
         style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke={color} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={size * 0.18} fill={accent || color}/>
    </svg>
  );
}

function VozWordmark({ size = 22, color = 'currentColor', accent }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.32,
      color,
    }}>
      <VozMark size={size * 1.05} color={color} accent={accent} />
      <span style={{
        fontFamily: '"Newsreader", Georgia, serif',
        fontSize: size, fontWeight: 400, fontStyle: 'italic',
        letterSpacing: -0.01 * size, lineHeight: 1,
        fontVariationSettings: '"opsz" 36',
      }}>vozcoletiva</span>
    </div>
  );
}

// Avatar tones — modern, low-chroma backgrounds with vivid text in matching
// hue. All share L+C so the row of avatars reads as a family.
const VOZ_TONES = {
  a: ['oklch(0.92 0.03 265)', 'oklch(0.35 0.12 265)'],  // indigo
  b: ['oklch(0.92 0.03 305)', 'oklch(0.35 0.12 305)'],  // violet
  c: ['oklch(0.92 0.03 195)', 'oklch(0.35 0.10 195)'],  // teal
  d: ['oklch(0.92 0.03 155)', 'oklch(0.35 0.10 155)'],  // emerald
  e: ['oklch(0.92 0.03 70)',  'oklch(0.35 0.12 70)'],   // amber
  f: ['oklch(0.92 0.03 25)',  'oklch(0.35 0.14 25)'],   // coral
  g: ['oklch(0.92 0.03 340)', 'oklch(0.35 0.12 340)'],  // pink
};
function Avatar({ user, size = 32, ring }) {
  const tone = VOZ_TONES[user?.tone || 'a'];
  // ME() can override its initials with an uploaded photo (set globally by App
  // from the tweak so we don't need to prop-drill through every Avatar usage).
  const imageUrl = user?.id === 'u1' ? window.VOZ_ME_AVATAR_URL : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: imageUrl ? '#0001' : tone[0],
      color: tone[1],
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Public Sans", system-ui, sans-serif',
      fontWeight: 600, fontSize: size * 0.4, letterSpacing: 0,
      boxShadow: ring ? `0 0 0 2px ${ring}` : 'none', flexShrink: 0,
      overflow: 'hidden',
      backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center',
    }}>{imageUrl ? null : (user?.initials || '?')}</div>
  );
}

function AvatarStack({ users, size = 24, max = 4, theme }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div style={{ display: 'inline-flex' }}>
      {shown.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
          <Avatar user={u} size={size} ring={theme?.surface} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          marginLeft: -size * 0.35,
          width: size, height: size, borderRadius: 999,
          background: theme?.surface2 || '#eee',
          color: theme?.inkSoft, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Public Sans", sans-serif', fontWeight: 600,
          fontSize: size * 0.36,
          boxShadow: `0 0 0 2px ${theme?.surface}`,
        }}>+{extra}</div>
      )}
    </div>
  );
}

// ── button ─────────────────────────────────────────────────────────────────
function Button({
  children, onClick, variant = 'secondary', size = 'md',
  block, theme, disabled, style = {}, type = 'button',
}) {
  const sizes = {
    sm: { h: 34, fs: 13, px: 14, r: 10 },
    md: { h: 46, fs: 15, px: 18, r: 12 },
    lg: { h: 54, fs: 16, px: 22, r: 14 },
  }[size];
  const variants = {
    primary: {
      bg: theme.accent, fg: theme.accentInk,
      border: 'transparent', fw: 600,
      shadow: theme.shadowSm,
    },
    secondary: {
      bg: theme.surface, fg: theme.ink,
      border: theme.border, fw: 500,
      shadow: theme.shadowSm,
    },
    ghost: {
      bg: 'transparent', fg: theme.ink,
      border: 'transparent', fw: 500, shadow: 'none',
    },
    danger: {
      bg: 'transparent', fg: theme.no,
      border: theme.border, fw: 500, shadow: 'none',
    },
    yes: { bg: theme.yes, fg: '#fff', border: 'transparent', fw: 600, shadow: theme.shadowSm },
    no:  { bg: theme.no,  fg: '#fff', border: 'transparent', fw: 600, shadow: theme.shadowSm },
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        appearance: 'none', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1, width: block ? '100%' : 'auto',
        height: sizes.h, padding: `0 ${sizes.px}px`,
        borderRadius: sizes.r,
        border: `0.5px solid ${variants.border}`,
        background: variants.bg, color: variants.fg,
        boxShadow: variants.shadow,
        fontFamily: '"Public Sans", system-ui, sans-serif',
        fontSize: sizes.fs, fontWeight: variants.fw, letterSpacing: -0.005,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, transition: 'transform .08s ease, background .12s ease, box-shadow .12s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(0.5px) scale(0.995)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}>
      {children}
    </button>
  );
}

// ── pill / chip / badge ────────────────────────────────────────────────────
function Pill({ children, tone = 'neutral', theme, size = 'md', style = {} }) {
  const tones = {
    neutral:    { bg: theme.surface2, fg: theme.inkSoft, br: 'transparent' },
    accent:     { bg: theme.accentSoft, fg: theme.accent, br: 'transparent' },
    yes:        { bg: 'transparent', fg: theme.yes, br: theme.yes },
    no:         { bg: 'transparent', fg: theme.no,  br: theme.no },
    voting:     { bg: theme.surface2, fg: theme.ink, br: 'transparent' },
    withdrawn:  { bg: theme.surface2, fg: theme.inkMute, br: 'transparent' },
    quorum:     { bg: 'transparent', fg: theme.warn, br: theme.warn },
  }[tone];
  const sizes = {
    sm: { h: 22, px: 9, fs: 11 },
    md: { h: 28, px: 11, fs: 12 },
  }[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: 999,
      background: tones.bg, color: tones.fg,
      border: tones.br === 'transparent' ? 'none' : `1px solid ${tones.br}`,
      fontFamily: '"Public Sans", sans-serif', fontSize: sizes.fs,
      fontWeight: 500, letterSpacing: 0, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

function StateBadge({ state, theme, t }) {
  const map = {
    voting:    { label: t.state_voting, tone: 'accent', dot: theme.accent },
    passed:    { label: t.state_passed, tone: 'yes' },
    rejected:  { label: t.state_rejected, tone: 'no' },
    quorum:    { label: t.state_quorum, tone: 'quorum' },
    withdrawn: { label: t.state_withdrawn, tone: 'withdrawn' },
  }[state] || { label: state, tone: 'neutral' };
  return (
    <Pill tone={map.tone} theme={theme}>
      {map.dot && (
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: map.dot,
          boxShadow: `0 0 0 3px ${theme.accent}22`,
        }} />
      )}
      {map.label}
    </Pill>
  );
}

// ── field (text input / textarea) ──────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, theme, type = 'text',
  rows, hint, suffix, autoFocus, mono, large,
}) {
  const [focused, setFocused] = React.useState(false);
  const Tag = rows ? 'textarea' : 'input';
  return (
    <label style={{ display: 'block', fontFamily: '"Public Sans", sans-serif' }}>
      {label && (
        <div style={{
          fontSize: 12, fontWeight: 500, letterSpacing: 0.04,
          color: theme.inkSoft, textTransform: 'uppercase',
          marginBottom: 6,
        }}>{label}</div>
      )}
      <div style={{ position: 'relative' }}>
        <Tag
          type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoFocus={autoFocus} rows={rows}
          style={{
            appearance: 'none', width: '100%', boxSizing: 'border-box',
            background: theme.fieldBg, color: theme.ink,
            border: `1px solid ${focused ? theme.accent : 'transparent'}`,
            outline: 'none', borderRadius: 14,
            padding: rows ? '14px 16px' : '0 16px',
            paddingRight: suffix ? 38 : undefined,
            height: rows ? 'auto' : (large ? 56 : 48),
            fontFamily: mono ? '"JetBrains Mono", ui-monospace, monospace'
                              : '"Public Sans", sans-serif',
            fontSize: large ? 17 : 15, fontWeight: 400, lineHeight: 1.5,
            letterSpacing: mono ? 2 : 0,
            transition: 'border-color .12s ease, background .12s ease',
            resize: rows ? 'vertical' : undefined,
            boxShadow: focused ? `0 0 0 3px ${theme.accent}1f` : 'none',
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', top: 0, right: 12, height: '100%',
            display: 'flex', alignItems: 'center',
            color: theme.inkMute, fontSize: 13,
          }}>{suffix}</div>
        )}
      </div>
      {hint && (
        <div style={{
          fontSize: 12, color: theme.inkMute, marginTop: 6, lineHeight: 1.5,
        }}>{hint}</div>
      )}
    </label>
  );
}

// ── card ───────────────────────────────────────────────────────────────────
function Card({ children, theme, onClick, style = {}, padded = true, flat }) {
  return (
    <div onClick={onClick}
      style={{
        background: theme.surface,
        border: `0.5px solid ${theme.border}`,
        borderRadius: 18, padding: padded ? 18 : 0,
        boxShadow: flat ? 'none' : theme.shadow,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s ease, transform .12s ease',
        ...style,
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = theme.shadowLg; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = flat ? 'none' : theme.shadow; } : undefined}>
      {children}
    </div>
  );
}

// ── tally bar (yes/no/abstain) ─────────────────────────────────────────────
function TallyBar({ proposal, theme, t, mode = 'visible' }) {
  const y = proposal.votes.yes.length;
  const n = proposal.votes.no.length;
  const a = proposal.votes.abstain.length;
  const total = y + n + a;
  const decisive = y + n;
  const required = proposal.rule === 'supermajority'
    ? Math.ceil(decisive * 2 / 3) : Math.floor(decisive / 2) + 1;
  if (mode === 'hidden') {
    return (
      <div style={{
        padding: 14, border: `1px dashed ${theme.border}`, borderRadius: 10,
        color: theme.inkMute, fontSize: 13, textAlign: 'center',
      }}>
        Vote to reveal the running tally.
      </div>
    );
  }
  if (total === 0) {
    return (
      <div style={{ color: theme.inkMute, fontSize: 13 }}>No votes yet.</div>
    );
  }
  const pct = (x) => total === 0 ? 0 : (x / total * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden',
        background: theme.surface2, border: `1px solid ${theme.border}`,
      }}>
        <div style={{ width: `${pct(y)}%`, background: theme.yes }} />
        <div style={{ width: `${pct(n)}%`, background: theme.no }} />
        <div style={{ width: `${pct(a)}%`, background: theme.abstain, opacity: 0.4 }} />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        fontFamily: '"Public Sans", sans-serif',
      }}>
        {[
          { label: t.yes, n: y, color: theme.yes },
          { label: t.no, n: n, color: theme.no },
          { label: t.abstain, n: a, color: theme.abstain },
        ].map((row) => (
          <div key={row.label} style={{
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: 2, background: row.color,
              }} />
              <span style={{ fontSize: 12, color: theme.inkSoft, fontWeight: 500 }}>
                {row.label}
              </span>
            </div>
            <div style={{
              fontFamily: '"Newsreader", serif',
              fontSize: 22, fontWeight: 400, color: theme.ink,
              fontVariationSettings: '"opsz" 36',
            }}>{row.n}</div>
          </div>
        ))}
      </div>
      <div style={{
        fontSize: 11.5, color: theme.inkMute, fontFamily: '"Public Sans", sans-serif',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{decisive > 0 ? `${y} of ${decisive} decisive · need ${required}` : 'awaiting first decisive vote'}</span>
        {proposal.quorum && (
          <span style={{ color: total >= proposal.quorum ? theme.yes : theme.warn }}>
            {t.quorum}: {total}/{proposal.quorum}
          </span>
        )}
      </div>
    </div>
  );
}

// ── time formatting ────────────────────────────────────────────────────────
function fmtTimeLeft(ms, lang) {
  if (ms <= 0) return lang === 'pt' ? 'encerrado' : 'closed';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 2) return lang === 'pt' ? `${d} dias` : `${d} days`;
  if (d === 1) return lang === 'pt' ? `1 dia ${h % 24}h` : `1d ${h % 24}h`;
  if (h >= 1) return lang === 'pt' ? `${h}h ${m % 60}min` : `${h}h ${m % 60}m`;
  return lang === 'pt' ? `${m} min` : `${m} min`;
}

function fmtAgo(ms, lang) {
  const past = VOZ_NOW - ms;
  const min = Math.floor(past / 60000);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d >= 7) {
    const wk = Math.floor(d / 7);
    return lang === 'pt' ? `${wk} sem` : `${wk}w`;
  }
  if (d >= 1) return lang === 'pt' ? `há ${d}d` : `${d}d ago`;
  if (hr >= 1) return lang === 'pt' ? `há ${hr}h` : `${hr}h ago`;
  if (min >= 1) return lang === 'pt' ? `há ${min}min` : `${min}m ago`;
  return lang === 'pt' ? 'agora' : 'now';
}

// ── icon set (hand-rolled simple line icons) ───────────────────────────────
const VozIcon = {
  back: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>,
  plus: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v12M3 9h12" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>,
  chevron: (c) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check: (c) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  proposals: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3.5" y="3" width="13" height="14" rx="2" stroke={c} strokeWidth="1.4"/><path d="M6.5 7h7M6.5 10h7M6.5 13h4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  documents: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/><path d="M12 3v4h4" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 11h6M7 14h4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  messages: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-1-2V5z" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  search: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5" stroke={c} strokeWidth="1.5"/><path d="M13 13l4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>,
  members: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7.5" r="2.7" stroke={c} strokeWidth="1.4"/><circle cx="13.5" cy="8" r="2.2" stroke={c} strokeWidth="1.4"/><path d="M2.5 16c.5-2.4 2.3-3.7 4.5-3.7s4 1.3 4.5 3.7M13 12.5c1.7.3 3 1.4 3.5 3.2" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  invite: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 7l7 4.5L17 7M3 7v8a1 1 0 001 1h12a1 1 0 001-1V7M3 7l1-1.5h12L17 7" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  you: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke={c} strokeWidth="1.4"/><path d="M3 17c1-3.5 3.5-5 7-5s6 1.5 7 5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  dots: (c) => <svg width="18" height="4" viewBox="0 0 18 4"><circle cx="2" cy="2" r="1.5" fill={c}/><circle cx="9" cy="2" r="1.5" fill={c}/><circle cx="16" cy="2" r="1.5" fill={c}/></svg>,
  copy: (c) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.4"/><path d="M10 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1" stroke={c} strokeWidth="1.4"/></svg>,
  clock: (c) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.4" stroke={c} strokeWidth="1.3"/><path d="M7 4v3l2 1.5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  scale: (c) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M3 4h8M3 4l-2 4a2 2 0 004 0L3 4zm8 0l-2 4a2 2 0 004 0l-2-4z" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/></svg>,
};

Object.assign(window, {
  VozMark, VozWordmark, Avatar, AvatarStack,
  Button, Pill, StateBadge, Field, Card, TallyBar,
  fmtTimeLeft, fmtAgo, VozIcon,
});
