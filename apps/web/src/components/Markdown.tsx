import { lazy, Suspense } from 'react';

// Lazy-loaded so the markdown bundle (~28 KB gzip) only loads on routes
// that actually render user-generated bodies. The home + project lists
// pay zero weight for this.
const Renderer = lazy(() => import('./MarkdownRenderer'));

export function Markdown({ source }: { source: string }) {
  return (
    <Suspense fallback={<pre className="whitespace-pre-wrap text-sm">{source}</pre>}>
      <Renderer source={source} />
    </Suspense>
  );
}
