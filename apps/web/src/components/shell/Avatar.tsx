interface AvatarProps {
  displayName: string;
  size?: number;
  ring?: string;
  /** Override the URL; future profile-photo slice supplies this. */
  imageUrl?: string | null;
}

/**
 * Round avatar. Derives a stable hue from the display name so two users with
 * the same initial don't collide. When an image is provided it covers the
 * circle; otherwise initials are centred.
 */
export function Avatar({ displayName, size = 32, ring, imageUrl }: AvatarProps) {
  const initials = toInitials(displayName);
  const hue = hashHue(displayName);
  const bg = `oklch(0.92 0.03 ${hue})`;
  const fg = `oklch(0.35 0.12 ${hue})`;
  return (
    <span
      aria-hidden={!displayName}
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 999,
        // backgroundColor (not the `background` shorthand) so it doesn't fight
        // the backgroundImage/Size/Position longhands below — React warns on
        // mixing shorthand + longhand for the same property during rerender.
        backgroundColor: imageUrl ? '#0001' : bg,
        color: fg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: size * 0.4,
        letterSpacing: 0,
        boxShadow: ring ? `0 0 0 2px ${ring}` : 'none',
        overflow: 'hidden',
        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {imageUrl ? null : initials}
    </span>
  );
}

function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  // Map to one of seven evenly-spaced hues so the avatar palette stays in the
  // design's family rather than going random.
  const hues = [265, 305, 195, 155, 70, 25, 340];
  return hues[Math.abs(h) % hues.length]!;
}
