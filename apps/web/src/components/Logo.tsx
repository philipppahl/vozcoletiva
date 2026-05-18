export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="vozcoletiva">
      <title>vozcoletiva</title>
      <rect width="64" height="64" rx="14" ry="14" fill="var(--brand)" />
      <path
        d="M 16 20 L 30 46 L 48 14"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="14" r="4" fill="var(--accent)" />
    </svg>
  );
}
