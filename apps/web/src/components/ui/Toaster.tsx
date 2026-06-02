import { useToastStore } from '../../lib/toast';

/** Renders transient toasts. Mounted once near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto w-full max-w-sm rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg"
          style={{
            background: t.tone === 'error' ? 'var(--color-danger, #c0392b)' : 'var(--surface)',
            color: t.tone === 'error' ? '#fff' : 'var(--ink)',
            border: '0.5px solid var(--border)',
          }}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
