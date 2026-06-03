import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import { toReplyTo } from '../../lib/messages';
import type { Attachment, Message } from '../../lib/messages/types';
import { toast } from '../../lib/toast';
import { compressImage, extOf, uploadBlob } from '../../lib/uploads';
import { Sheet } from '../ui/Sheet';
import type { MentionCandidate } from './MentionPopover';
import { MentionPopover } from './MentionPopover';
import { QuoteBody } from './QuoteHeader';

// Slide the mic this far left while holding to cancel a voice note (Telegram).
const CANCEL_DX = -90;

interface MessageComposerProps {
  /** Members of the conversation, used for the mention popover. */
  mentionCandidates: MentionCandidate[];
  /** Called with the typed body + any attachments collected. */
  onSubmit: (body: string, attachments: Attachment[]) => Promise<void> | void;
  /** When true, the composer is awaiting a server response. */
  pending: boolean;
  placeholder?: string;
  /** The message being quote-replied to (decision 0031); shows a chip. */
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageComposer({
  mentionCandidates,
  onSubmit,
  pending,
  placeholder,
  replyingTo,
  onCancelReply,
}: MessageComposerProps) {
  const { _ } = useLingui();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(0);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeMention, setActiveMention] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startMsRef = useRef(0);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Attachment type picker + the press-and-hold voice gesture (Telegram-style).
  const [attachOpen, setAttachOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const holdStartXRef = useRef(0);
  const holdStartTimeRef = useRef(0);
  const willCancelRef = useRef(false);
  const holdingRef = useRef(false);

  const uploading = attachments.some((a) => a._uploading);

  // Release the mic + timer if the composer unmounts mid-recording.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => {
        tr.stop();
      });
    },
    [],
  );

  const filtered = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter((c) => c.display_name.toLowerCase().includes(q) || c.handle.includes(q))
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  function updateValue(next: string) {
    setValue(next);
    const caret = ref.current?.selectionStart ?? next.length;
    const upToCaret = next.slice(0, caret);
    // Trigger the picker on a partial @handle (letters/digits/underscore) at the
    // caret, but only at a mention boundary (not inside an email).
    const m = /(?<![A-Za-z0-9_])@([A-Za-z0-9_]*)$/.exec(upToCaret);
    if (m) {
      setMentionQuery(m[1] ?? '');
      setActiveMention(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(c: MentionCandidate) {
    const ta = ref.current;
    const caret = ta?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const tokenStart = before.lastIndexOf('@');
    if (tokenStart < 0) return;
    const next = `${before.slice(0, tokenStart)}@${c.handle} ${after}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      const newCaret = tokenStart + c.handle.length + 2;
      ta?.setSelectionRange(newCaret, newCaret);
    });
  }

  // Upload picked images (downscaled to WebP) — the chip shows a local preview
  // while the upload runs, then swaps to the CDN URL.
  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const tempKey = `pending-${tempIdRef.current++}`;
      let previewUrl = '';
      try {
        const { blob, width, height, ext } = await compressImage(file);
        previewUrl = URL.createObjectURL(blob);
        setAttachments((prev) => [
          ...prev,
          {
            kind: 'image',
            url: previewUrl,
            key: tempKey,
            mime: blob.type,
            size: blob.size,
            width,
            height,
            _uploading: true,
          },
        ]);
        const { key, url } = await uploadBlob(blob, ext);
        setAttachments((prev) =>
          prev.map((a) => (a.key === tempKey ? { ...a, key, url, _uploading: false } : a)),
        );
        URL.revokeObjectURL(previewUrl);
      } catch {
        setAttachments((prev) => prev.filter((a) => a.key !== tempKey));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        toast.error('Couldn’t add that image.');
      }
    }
  }

  async function onPickDoc(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const tempKey = `pending-${tempIdRef.current++}`;
      setAttachments((prev) => [
        ...prev,
        {
          kind: 'doc',
          url: '',
          key: tempKey,
          mime: file.type || 'application/octet-stream',
          name: file.name,
          size: file.size,
          _uploading: true,
        },
      ]);
      try {
        const { key, url } = await uploadBlob(file, extOf(file.name));
        setAttachments((prev) =>
          prev.map((a) => (a.key === tempKey ? { ...a, key, url, _uploading: false } : a)),
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a.key !== tempKey));
        toast.error('Couldn’t add that file.');
      }
    }
  }

  function pickAudioMime(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return '';
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // The finger may have lifted while the permission/stream was resolving.
      if (!holdingRef.current) {
        stream.getTracks().forEach((tr) => {
          tr.stop();
        });
        return;
      }
      streamRef.current = stream;
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => void finishRecording();
      recorderRef.current = rec;
      rec.start();
      startMsRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startMsRef.current), 200);
    } catch {
      toast.error('Couldn’t access the microphone.');
    }
  }

  function stopRecording(cancel: boolean) {
    cancelRef.current = cancel;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }

  async function finishRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    streamRef.current?.getTracks().forEach((tr) => {
      tr.stop();
    });
    streamRef.current = null;
    const durationMs = Date.now() - startMsRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    // Discard cancels + accidental sub-half-second taps.
    if (cancelRef.current || chunks.length === 0 || durationMs < 500) return;
    const type = chunks[0]?.type || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') || type.includes('mpeg') ? 'm4a' : 'webm';
    // Telegram-style: releasing the hold *sends* the voice note right away
    // (decision 0031) — upload, then post it as its own message.
    try {
      const { key, url } = await uploadBlob(blob, ext);
      await onSubmit('', [
        { kind: 'voice', key, url, mime: type, size: blob.size, duration_ms: durationMs },
      ]);
    } catch {
      toast.error('Couldn’t send that voice note.');
    }
  }

  function submit() {
    const body = value.trim();
    const ready = attachments.filter((a) => !a._uploading);
    if (!body && ready.length === 0) return;
    if (uploading) return; // wait for in-flight uploads
    setValue('');
    setAttachments([]);
    setMentionQuery(null);
    void onSubmit(body, ready);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMention((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMention((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const pick = filtered[activeMention];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = !pending && !uploading && (value.trim().length > 0 || attachments.length > 0);
  // With text/attachments the right button sends; empty, it's the hold-to-record
  // mic (Telegram). Recording only happens from an empty input.
  const hasContent = value.trim().length > 0 || attachments.length > 0;
  const recordingMode = recording || holding;
  const willCancel = slideX <= CANCEL_DX;

  // ── press-and-hold voice gesture ───────────────────────────────────────────
  function startHold(e: React.PointerEvent) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is gone; ignore.
    }
    holdStartXRef.current = e.clientX;
    holdStartTimeRef.current = Date.now();
    willCancelRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    setSlideX(0);
    void startRecording();
  }
  function moveHold(e: React.PointerEvent) {
    if (!holdingRef.current) return;
    const dx = Math.min(0, e.clientX - holdStartXRef.current);
    setSlideX(dx);
    willCancelRef.current = dx <= CANCEL_DX;
  }
  function endHold(e: React.PointerEvent) {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const cancel = willCancelRef.current;
    const tooShort = Date.now() - holdStartTimeRef.current < 500;
    setHolding(false);
    setSlideX(0);
    stopRecording(cancel);
    if (!cancel && tooShort) toast.error(_(t`Hold to record — release to send.`));
  }

  return (
    <div
      className="relative flex flex-col gap-2 border-t px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {replyingTo && (
        <div
          className="flex items-stretch gap-2 rounded-lg px-2 py-1.5"
          style={{ background: 'var(--surface-2)' }}
        >
          <span
            aria-hidden="true"
            style={{ width: 2.5, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }}
          />
          <span className="min-w-0 flex-1 py-0.5">
            <span
              className="block truncate text-[12px] font-semibold leading-tight"
              style={{ color: 'var(--accent)' }}
            >
              <Trans>Replying to {replyingTo.author_display_name}</Trans>
            </span>
            <span
              className="block truncate text-[12.5px] leading-tight"
              style={{ color: 'var(--ink-soft)' }}
            >
              <QuoteBody reply={toReplyTo(replyingTo)} />
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label={_(t`Cancel reply`)}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full self-center"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-soft)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-1">
          {attachments.map((a) => (
            <li
              key={a.key}
              className="relative flex items-center gap-2 overflow-hidden rounded-lg"
              style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)' }}
            >
              {a.kind === 'image' ? (
                <img
                  src={a.url}
                  alt=""
                  style={{ display: 'block', width: 56, height: 56, objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="flex items-center gap-2 px-2.5 py-2"
                  style={{ maxWidth: 180, color: 'var(--ink-soft)' }}
                >
                  {a.kind === 'voice' ? <MicIcon /> : <DocIcon />}
                  <span className="truncate text-[12px]" style={{ color: 'var(--ink)' }}>
                    {a.kind === 'voice' ? fmtClock(a.duration_ms ?? 0) : (a.name ?? 'file')}
                  </span>
                </div>
              )}
              {a._uploading && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.35)' }}
                >
                  <Spinner />
                </div>
              )}
              {!a._uploading && (
                <button
                  type="button"
                  aria-label={_(t`Remove attachment`)}
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.key !== a.key))}
                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex items-center gap-2">
        {/* Hidden file inputs, driven by the attachment-type sheet. */}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickImage}
          style={{ display: 'none' }}
        />
        <input
          ref={docInputRef}
          type="file"
          multiple
          onChange={onPickDoc}
          style={{ display: 'none' }}
        />

        {recordingMode ? (
          /* Recording bar — the held mic (right) slides left over this to cancel. */
          <div className="flex flex-1 items-center gap-2 pl-2" style={{ height: 40 }}>
            <span
              className="inline-block animate-pulse"
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: 'var(--no)',
                flexShrink: 0,
              }}
            />
            <span
              className="text-[14px] font-medium"
              style={{ color: 'var(--no)', fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtClock(elapsedMs)}
            </span>
            <span
              className="flex-1 select-none truncate text-right text-[13px]"
              style={{
                color: willCancel ? 'var(--no)' : 'var(--ink-muted)',
                transition: 'color .1s',
              }}
            >
              {willCancel ? <Trans>Release to cancel</Trans> : <Trans>‹ slide to cancel</Trans>}
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              aria-label={_(t`Add attachment`)}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--surface-2)',
                border: '0.5px solid var(--border)',
                color: 'var(--ink-soft)',
                cursor: 'pointer',
              }}
            >
              <PlusIcon />
            </button>
            <div className="relative min-w-0 flex-1">
              {mentionQuery !== null && (
                <MentionPopover
                  candidates={filtered}
                  active={activeMention}
                  onPick={insertMention}
                  onHover={setActiveMention}
                />
              )}
              <textarea
                ref={ref}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder ?? _(t`Message`)}
                rows={1}
                className="block w-full resize-none rounded-2xl px-4 py-2 outline-none"
                style={{
                  background: 'var(--field-bg)',
                  color: 'var(--ink)',
                  border: '1px solid transparent',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  lineHeight: 1.4,
                  minHeight: 40,
                  maxHeight: 200,
                }}
              />
            </div>
          </>
        )}

        {/* Right button: send (content present) or the hold-to-record mic (empty). */}
        {hasContent ? (
          <button
            type="button"
            onClick={() => submit()}
            disabled={!canSend}
            aria-label={_(t`Send message`)}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.5,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 8l12-6-4 14-3-6-5-2z" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={startHold}
            onPointerMove={moveHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            aria-label={_(t`Hold to record a voice note`)}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: holding
                ? willCancel
                  ? 'var(--no)'
                  : 'var(--accent)'
                : 'var(--surface-2)',
              color: holding ? 'var(--accent-ink)' : 'var(--ink-soft)',
              border: holding ? 'none' : '0.5px solid var(--border)',
              transform: holding ? `translateX(${slideX}px) scale(1.12)` : undefined,
              transition: holding ? 'none' : 'transform .15s ease, background .15s ease',
              touchAction: 'none',
              cursor: 'pointer',
            }}
          >
            {willCancel ? <TrashIcon /> : <MicIcon />}
          </button>
        )}
      </div>
      <Sheet
        open={attachOpen}
        onOpenChange={setAttachOpen}
        side="bottom"
        title={<Trans>Add attachment</Trans>}
      >
        <div className="flex flex-col px-2 pb-4">
          <AttachRow
            icon={<PhotoIcon />}
            label={<Trans>Photo</Trans>}
            onClick={() => {
              setAttachOpen(false);
              imgInputRef.current?.click();
            }}
          />
          <AttachRow
            icon={<DocIcon />}
            label={<Trans>Document</Trans>}
            onClick={() => {
              setAttachOpen(false);
              docInputRef.current?.click();
            }}
          />
        </div>
      </Sheet>
    </div>
  );
}

function AttachRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px]"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
    >
      <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>{icon}</span>
      {label}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M5 17l4.5-4 3 2.5L16 12l3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 11a7 7 0 0014 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function fmtClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function DocIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M14 3v4a1 1 0 001 1h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 3h9l5 5v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.7s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
