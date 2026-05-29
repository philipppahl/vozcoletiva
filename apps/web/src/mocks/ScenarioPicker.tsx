import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useAuthStore } from '../lib/auth/store';
import { isMockMode } from './mode';
import { applyScenario, loadScenarioId, SCENARIOS } from './scenarios';

/**
 * Dev-only picker for swapping mock scenarios. Mounted inside the Preferences
 * page and gated by `isMockMode()` so it disappears entirely in real builds.
 */
export function ScenarioPicker() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(() => loadScenarioId());

  if (!isMockMode()) return null;

  function applyAndReset(scenarioId: string) {
    setCurrent(scenarioId);
    applyScenario(scenarioId);
    // Reset client-side state: sign out (so the next sign-in picks up the new
    // identity), clear the query cache, navigate to home.
    useAuthStore.getState().clear();
    queryClient.clear();
    void navigate({ to: '/' });
  }

  return (
    <section className="px-4 pt-6">
      <h3
        className="mb-2 px-1 text-[11px] font-semibold uppercase"
        style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
      >
        Mock scenario
      </h3>
      <div
        className="rounded-2xl p-2"
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <ul className="flex flex-col">
          {SCENARIOS.map((s, i) => {
            const active = current === s.id;
            return (
              <li
                key={s.id}
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => applyAndReset(s.id)}
                  className="flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--ink-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    {s.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 px-2 text-[11px]" style={{ color: 'var(--ink-muted)', lineHeight: 1.5 }}>
        Switching a scenario resets the in-memory db, clears your session, and sends you back to the
        home screen. The picker only renders in mock mode.
      </p>
    </section>
  );
}
