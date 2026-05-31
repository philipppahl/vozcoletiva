import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import { getDb } from '../db';
import { requireCurrentUser } from './_helpers';

function profileDto(me: { userId: string; displayName: string }) {
  return {
    user_id: me.userId,
    display_name: me.displayName,
    locale: 'en',
    theme: 'system',
    created_at: mockNowIso(),
  };
}

export const meHandlers = [
  http.get('*/v1/me', () => {
    const me = requireCurrentUser();
    if (!me)
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Not signed in' },
        { status: 401 },
      );
    return HttpResponse.json(profileDto(me));
  }),
  // Display name is set here now (Cognito is auth-only) — see decision 0019.
  http.patch('*/v1/me', async ({ request }) => {
    const me = requireCurrentUser();
    if (!me)
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Not signed in' },
        { status: 401 },
      );
    const body = (await request.json()) as { display_name?: string };
    const name = (body.display_name ?? '').trim();
    if (!name)
      return HttpResponse.json(
        { error: 'bad_request', message: 'display name must not be empty' },
        { status: 400 },
      );
    me.displayName = name;
    getDb().users.set(me.userId, me);
    return HttpResponse.json(profileDto(me));
  }),
  http.get('*/v1/hello', () => HttpResponse.json({ ok: true, version: 'mock-1' })),
];
