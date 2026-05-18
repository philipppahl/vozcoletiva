interface RoleBadgeProps {
  role: 'owner' | 'admin' | 'moderator' | 'member' | 'observer';
}

const COLOURS: Record<RoleBadgeProps['role'], string> = {
  owner: 'var(--brand)',
  admin: 'var(--color-primary-600)',
  moderator: 'var(--color-primary-500)',
  member: 'var(--color-neutral-500)',
  observer: 'var(--color-neutral-400)',
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
      style={{
        background: COLOURS[role],
        color: '#ffffff',
      }}
    >
      {role}
    </span>
  );
}
