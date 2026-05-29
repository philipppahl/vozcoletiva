import { beforeEach, describe, expect, it } from 'vitest';

import {
  _resetOnboardingForTests,
  completeOnboarding,
  isOnboardingComplete,
} from '../src/lib/onboarding';

beforeEach(() => {
  _resetOnboardingForTests();
});

describe('onboarding flag', () => {
  it('starts off', () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it('flips on when completeOnboarding() is called', () => {
    completeOnboarding();
    expect(isOnboardingComplete()).toBe(true);
  });

  it('is idempotent — calling twice is harmless', () => {
    completeOnboarding();
    completeOnboarding();
    expect(isOnboardingComplete()).toBe(true);
  });

  it('treats malformed values as not-complete', () => {
    window.localStorage.setItem('voz.onboarding.completed', 'true'); // wrong shape
    expect(isOnboardingComplete()).toBe(false);
    window.localStorage.setItem('voz.onboarding.completed', '0');
    expect(isOnboardingComplete()).toBe(false);
  });
});
