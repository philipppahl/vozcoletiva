import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

import { useKeyboardInset } from '../../lib/useKeyboardInset';

// Downward drag (px) on the grabber that dismisses a bottom sheet.
const DISMISS_DY = 90;

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
  // Lift a bottom sheet above the on-screen keyboard so its input + content
  // stay reachable (e.g. the "New direct message" search). 0 for top sheets
  // and whenever the keyboard is closed.
  const kbInset = useKeyboardInset();
  const liftBy = isTop ? 0 : kbInset;

  // Drag-to-dismiss: pulling the grabber down past DISMISS_DY closes a bottom
  // sheet; a shorter pull springs back.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);

  const onHandleDown = (e: ReactPointerEvent) => {
    dragStartRef.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: ReactPointerEvent) => {
    if (dragStartRef.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  };
  const onHandleUp = () => {
    if (dragStartRef.current === null) return;
    const shouldClose = dragY > DISMISS_DY;
    dragStartRef.current = null;
    setDragging(false);
    setDragY(0);
    if (shouldClose) onOpenChange(false);
  };

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
            bottom: isTop ? 'auto' : liftBy,
            zIndex: 70,
            maxHeight: liftBy ? `calc(85dvh - ${liftBy}px)` : '85dvh',
            overflowY: 'auto',
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: dragging
              ? 'none'
              : 'transform 0.22s var(--ease-spring), bottom 0.18s ease, max-height 0.18s ease',
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
            // Grabber doubles as a drag-to-dismiss handle. The padded wrapper
            // is the touch target; touch-action:none so the drag doesn't scroll
            // the sheet body.
            <div
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              style={{
                touchAction: 'none',
                cursor: 'grab',
                margin: '-10px 0 6px',
                padding: '8px 0',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--border)',
                  margin: '0 auto',
                }}
                aria-hidden
              />
            </div>
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
