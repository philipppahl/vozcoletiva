interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

export function Logo({ size = 56, withWordmark = false }: LogoProps) {
  const mark = (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="vozcoletiva">
      <title>vozcoletiva</title>
      <rect width="64" height="64" rx="14" ry="14" fill="var(--accent)" />
      <path
        d="M 16 20 L 30 46 L 48 14"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="14" r="4" fill="var(--accent-soft)" />
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.32, color: 'var(--ink)' }}>
      {mark}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size * 0.7,
          fontStyle: 'italic',
          fontWeight: 400,
          letterSpacing: -0.01 * size,
          lineHeight: 1,
          fontVariationSettings: '"opsz" 36',
        }}
      >
        vozcoletiva
      </span>
    </span>
  );
}
