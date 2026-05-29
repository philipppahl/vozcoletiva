import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import { getDb } from '../db';
import { requireCurrentUser } from './_helpers';

export const meHandlers = [
  http.get('*/v1/me', ({ request }) => {
    const me = requireCurrentUser();
    if (!me)
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Not signed in' },
        { status: 401 },
      );
    const url = new URL(request.url);
    const displayName = url.searchParams.get('display_name');
    if (displayName && displayName.trim().length > 0) {
      me.displayName = displayName.trim();
      getDb().users.set(me.userId, me);
    }
    return HttpResponse.json({
      user_id: me.userId,
      display_name: me.displayName,
      locale: 'en',
      theme: 'system',
      created_at: mockNowIso(),
    });
  }),
  http.get('*/v1/hello', () => HttpResponse.json({ ok: true, version: 'mock-1' })),
];
