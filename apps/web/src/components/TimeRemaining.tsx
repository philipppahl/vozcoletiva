import { Trans } from '@lingui/macro';
import { useEffect, useState } from 'react';

/** Shows "in 12 minutes" / "in 3 hours" / "in 2 days" relative to now. */
export function TimeRemaining({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) {
    return (
      <span>
        <Trans>Closing now</Trans>
      </span>
    );
  }
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return (
      <span>
        <Trans>Closes in {minutes} min</Trans>
      </span>
    );
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return (
      <span>
        <Trans>Closes in {hours} h</Trans>
      </span>
    );
  }
  const days = Math.floor(hours / 24);
  return (
    <span>
      <Trans>Closes in {days} days</Trans>
    </span>
  );
}
