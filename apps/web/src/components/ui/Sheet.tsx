import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Title is shown visually unless `hideTitle` is set; either way the dialog
   *  always announces it for screen readers. */
  hideTitle?: boolean;
  description?: ReactNode;
  side?: 'top' | 'bottom';
  children: ReactNode;
}

/**
 * iOS-style sheet anchored to the top or bottom of the viewport, slides in
 * from that edge. Wraps Radix Dialog for focus trap, escape-to-close, and
 * click-outside-to-dismiss.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle = true,
  description,
  side = 'top',
  children,
}: SheetProps) {
  const isTop = side === 'top';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.32)',
            zIndex: 60,
            animation: 'voz-backdrop-in 0.18s ease',
          }}
        />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            top: isTop ? 0 : 'auto',
            bottom: isTop ? 'auto' : 0,
            zIndex: 70,
            maxHeight: '85dvh',
            overflowY: 'auto',
            background: 'var(--surface)',
            color: 'var(--ink)',
            borderBottomLeftRadius: isTop ? 24 : 0,
            borderBottomRightRadius: isTop ? 24 : 0,
            borderTopLeftRadius: isTop ? 0 : 24,
            borderTopRightRadius: isTop ? 0 : 24,
            boxShadow: 'var(--shadow-lg)',
            paddingTop: isTop ? 'calc(env(safe-area-inset-top) + 14px)' : 14,
            paddingBottom: isTop ? 22 : 'calc(env(safe-area-inset-bottom) + 22px)',
            animation: `voz-sheet-${isTop ? 'in' : 'in'} 0.24s var(--ease-spring)`,
          }}
        >
          {isTop ? null : (
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 999,
                background: 'var(--border)',
                margin: '0 auto 14px',
              }}
              aria-hidden
            />
          )}
          {hideTitle ? (
            <Dialog.Title
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }}
            >
              {title}
            </Dialog.Title>
          ) : (
            <Dialog.Title
              style={{
                padding: '0 18px 8px',
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                color: 'var(--ink)',
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Dialog.Title>
          )}
          {description && (
            <Dialog.Description
              style={{
                padding: '0 18px 10px',
                fontSize: 13,
                color: 'var(--ink-soft)',
              }}
            >
              {description}
            </Dialog.Description>
          )}
          {children}
          {isTop && (
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 999,
                background: 'var(--border)',
                margin: '14px auto 0',
              }}
              aria-hidden
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
