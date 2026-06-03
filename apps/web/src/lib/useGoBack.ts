import { useNavigate, useRouter } from '@tanstack/react-router';

/**
 * History-aware "back". Pops the previous screen when there is one to pop;
 * otherwise (deep link, fresh load, restored session) routes to a sensible
 * default so "back" never strands the user or exits the app.
 *
 * Use this for leaf screens reached from many places — preferences, direct
 * messages — where a fixed target would feel wrong ("back" should return you
 * to wherever you came from). Hierarchical detail pages that always belong to
 * one parent keep their explicit navigate() target instead.
 */
export function useGoBack(fallbackTo: string): () => void {
  const router = useRouter();
  const navigate = useNavigate();
  return () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: fallbackTo });
  };
}
