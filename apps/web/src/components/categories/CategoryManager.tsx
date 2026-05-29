import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from '../../lib/categories';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

interface CategoryManagerProps {
  slug: string;
}

export function CategoryManager({ slug }: CategoryManagerProps) {
  const { _ } = useLingui();
  const categories = useCategories(slug);
  const create = useCreateCategory(slug);
  const rename = useRenameCategory(slug);
  const remove = useDeleteCategory(slug);

  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await create.mutateAsync({ name: trimmed });
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : _(t`Something went wrong.`));
    }
  }

  async function onRenameSubmit(id: string) {
    setError(null);
    const trimmed = renameText.trim();
    if (!trimmed) return;
    try {
      await rename.mutateAsync({ id, name: trimmed });
      setRenameId(null);
      setRenameText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : _(t`Something went wrong.`));
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : _(t`Something went wrong.`));
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10">
      <form onSubmit={onCreate} className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label={_(t`Add a topic`)}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={_(t`e.g. Finance`)}
            maxLength={30}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={create.isPending || !newName.trim()}
        >
          <Trans>Add</Trans>
        </Button>
      </form>

      {error && (
        <p className="text-sm" style={{ color: 'var(--no)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h3
          className="text-xs font-semibold uppercase"
          style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
        >
          <Trans>Existing</Trans>
        </h3>
        <ul
          className="overflow-hidden rounded-2xl"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border)' }}
        >
          {categories.data?.categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
              {renameId === c.id ? (
                <>
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    maxLength={30}
                    // biome-ignore lint/a11y/noAutofocus: inline-edit affordance focuses the field the user just opened
                    autoFocus
                    className="flex-1 rounded-lg px-2 py-1.5 text-sm"
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--ink)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onRenameSubmit(c.id)}
                    className="text-sm font-semibold"
                    style={{
                      color: 'var(--accent)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <Trans>Save</Trans>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(null);
                      setRenameText('');
                    }}
                    className="text-sm"
                    style={{
                      color: 'var(--ink-muted)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <Trans>Cancel</Trans>
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {c.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(c.id);
                      setRenameText(c.name);
                    }}
                    className="text-xs font-semibold"
                    style={{
                      color: 'var(--accent)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <Trans>Rename</Trans>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    disabled={remove.isPending}
                    className="text-xs"
                    style={{
                      color: 'var(--no)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <Trans>Delete</Trans>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
