/**
 * Named scenarios for the picker. Each maps to a (identity, clockOffset)
 * pair. The project shape is determined by the seed.
 */

import { setMockClockOffset } from './clock';
import { startAutoEmit, stopAutoEmit } from './messageBus';
import { seed } from './seed';

export interface Scenario {
  id: string;
  label: string;
  description: string;
  identityKey: 'marina' | 'pedro' | 'claudia' | 'newcomer';
  /** Wall-clock offset in days from real now; positive = future. */
  clockOffsetDays: number;
  /** Auto-emit incoming messages on a timer to make channels feel alive. */
  autoEmit?: boolean;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'owner-rich',
    label: 'Owner · busy co-op',
    description: 'You own Vila Madalena (10 members, 8 proposals across every status).',
    identityKey: 'marina',
    clockOffsetDays: 0,
  },
  {
    id: 'admin-second-project',
    label: 'Admin · second project',
    description: "You're an Admin of Núcleo de Dança plus a Member of Software Livre BR.",
    identityKey: 'marina',
    clockOffsetDays: 0,
  },
  {
    id: 'observer-only',
    label: 'Observer',
    description:
      'You read but cannot act in Vila Madalena. Useful to verify role-gated affordances.',
    identityKey: 'pedro', // pedro is admin in VMC; using as a non-owner stand-in
    clockOffsetDays: 0,
  },
  {
    id: 'closing-soon',
    label: 'Closing soon',
    description: 'Clock advanced 3 hours — noise policy is now minutes from auto-close.',
    identityKey: 'marina',
    clockOffsetDays: 0,
  },
  {
    id: 'after-close',
    label: 'After auto-close',
    description: 'Clock advanced 8 days — the live proposals have all auto-closed.',
    identityKey: 'marina',
    clockOffsetDays: 8,
  },
  {
    id: 'newcomer',
    label: 'New user · no projects',
    description:
      "You just signed up. No memberships yet — only path forward is 'New project' or 'Join with code'.",
    identityKey: 'newcomer',
    clockOffsetDays: 0,
  },
  {
    id: 'busy-channels',
    label: 'Busy channels',
    description:
      'Mock channels gain a new incoming message every ~30 seconds. Useful for showing the chat live; annoying during static review.',
    identityKey: 'marina',
    clockOffsetDays: 0,
    autoEmit: true,
  },
];

const STORAGE_KEY = 'voz.mock.scenario';

export function defaultScenarioId(): string {
  return SCENARIOS[0]!.id;
}

export function loadScenarioId(): string {
  if (typeof window === 'undefined') return defaultScenarioId();
  return window.localStorage.getItem(STORAGE_KEY) ?? defaultScenarioId();
}

export function persistScenarioId(id: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

export function applyScenario(id: string) {
  const scenario = getScenario(id);
  const offsetMs = scenario.clockOffsetDays * 86_400_000;
  // "Advance the wall clock by N days" is implemented by aging the data
  // backwards. asOf = realNow - offset puts every relative timestamp
  // exactly `offset` further in the past, so the FE's wall-clock
  // `Date.now()` renders it as N days older. The mock clock stays
  // aligned with real now (offset 0) — autoCloseDuePoll then naturally
  // closes anything whose endsAt is in the past.
  seed({ identityKey: scenario.identityKey, asOfMs: Date.now() - offsetMs });
  setMockClockOffset(0);
  persistScenarioId(id);
  if (scenario.autoEmit) startAutoEmit();
  else stopAutoEmit();
}
