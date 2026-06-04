import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useCreateChannel } from '../../lib/messages';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

interface NewChannelSheetProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputStyle = {
  background: 'var(--field-bg)',
  color: 'var(--ink)',
  border: '1px solid transparent',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
} as const;

/**
 * "New channel" composer — name (required, ≤ 30) + optional description.
 * Moderators+ only (the API enforces it). On success, navigates into the new
 * channel. (decision 0034)
 */
export function NewChannelSheet({ slug, open, onOpenChange }: NewChannelSheetProps) {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const create = useCreateChannel(slug);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setError(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(_(t`Channel name is required.`));
      return;
    }
    setError(null);
    try {
      const channel = await create.mutateAsync({
        name: trimmed,
        description: description.trim() || undefined,
      });
      reset();
      onOpenChange(false);
      void navigate({
        to: '/p/$slug/messages/$channelId',
        params: { slug, channelId: channel.id },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : _(t`Couldn't create the channel. Please try again.`),
      );
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      side="bottom"
      title={<Trans>New channel</Trans>}
      hideTitle={false}
    >
      <div className="flex flex-col gap-3 px-4 pt-2 pb-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={_(t`Channel name`)}
          maxLength={30}
          className="h-11 w-full rounded-xl px-4 outline-none"
          style={inputStyle}
          // biome-ignore lint/a11y/noAutofocus: the sheet is an explicit compose action
          autoFocus
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={_(t`Description (optional)`)}
          className="h-11 w-full rounded-xl px-4 outline-none"
          style={inputStyle}
        />
        {error && (
          <span className="text-xs" style={{ color: 'var(--no)' }}>
            {error}
          </span>
        )}
        <Button block onClick={() => void submit()} disabled={create.isPending || !name.trim()}>
          {create.isPending ? <Trans>Creating…</Trans> : <Trans>Create channel</Trans>}
        </Button>
      </div>
    </Sheet>
  );
}
