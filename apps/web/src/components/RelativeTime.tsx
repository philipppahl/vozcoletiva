import { Trans } from '@lingui/macro';
import { useEffect, useState } from 'react';

/** "just now" / "5m" / "2h" / "3d" / absolute date for older. */
export function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 30_000) {
    return (
      <time dateTime={iso} title={new Date(iso).toLocaleString()}>
        <Trans>just now</Trans>
      </time>
    );
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return (
      <time dateTime={iso} title={new Date(iso).toLocaleString()}>
        <Trans>{minutes}m</Trans>
      </time>
    );
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return (
      <time dateTime={iso} title={new Date(iso).toLocaleString()}>
        <Trans>{hours}h</Trans>
      </time>
    );
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return (
      <time dateTime={iso} title={new Date(iso).toLocaleString()}>
        <Trans>{days}d</Trans>
      </time>
    );
  }
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()}>
      {new Date(iso).toLocaleDateString()}
    </time>
  );
}
