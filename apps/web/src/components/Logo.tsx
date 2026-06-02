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
        d="M 15 30 L 27 46 L 50 12"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Warm accent dot — fixed (not accent-soft) so it stays visible on the
          indigo mark, echoing the original coral-on-turquoise contrast. */}
      <circle cx="50" cy="12" r="5" fill="#F5A623" />
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
