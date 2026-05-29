/**
 * First-launch onboarding state. Stored in localStorage as a single flag;
 * the eventual real backend can promote this to a `UserProfile.onboarded_at`
 * column if we ever need cross-device persistence.
 */

const KEY = 'voz.onboarding.completed';

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY) === '1';
}

export function completeOnboarding(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, '1');
}

/** Test-only reset. Production paths never need to clear the flag. */
export function _resetOnboardingForTests(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
