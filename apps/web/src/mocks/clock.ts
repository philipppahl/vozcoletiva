/**
 * Mock-side clock. Lets the scenario picker shift the *server's* idea of
 * "now" without monkey-patching Date globally — only handlers read this.
 */
let offsetMs = 0;

export function setMockClockOffset(ms: number) {
  offsetMs = ms;
}

export function getMockClockOffset(): number {
  return offsetMs;
}

export function mockNow(): number {
  return Date.now() + offsetMs;
}

export function mockNowIso(): string {
  return new Date(mockNow()).toISOString();
}
