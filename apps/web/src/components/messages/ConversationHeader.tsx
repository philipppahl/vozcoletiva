import { Trans } from '@lingui/macro';
import { useAuth } from '../../lib/auth/hooks';
import type { Conversation } from '../../lib/messages/types';
import { Avatar } from '../shell/Avatar';
import { TopBar } from '../shell/TopBar';

interface ConversationHeaderProps {
  conversation: Conversation | undefined;
  fallbackTitle?: string;
  onBack: () => void;
}

export function ConversationHeader({
  conversation,
  fallbackTitle,
  onBack,
}: ConversationHeaderProps) {
  const { session } = useAuth();
  if (!conversation) {
    return <TopBar title={fallbackTitle ?? <Trans>Conversation</Trans>} onBack={onBack} />;
  }
  if (conversation.kind === 'channel') {
    return (
      <TopBar
        title={`#${conversation.name}`}
        eyebrow={
          conversation.member_count > 0 ? (
            <Trans>{conversation.member_count} members</Trans>
          ) : undefined
        }
        onBack={onBack}
      />
    );
  }
  const peer =
    conversation.participants.find((p) => p.user_id !== session?.userId) ??
    conversation.participants[0]!;
  return (
    <TopBar
      title={
        <span className="inline-flex items-center gap-2">
          <Avatar displayName={peer.display_name} size={26} />
          <span style={{ color: 'var(--ink)' }}>{peer.display_name}</span>
        </span>
      }
      eyebrow={<Trans>Direct message</Trans>}
      onBack={onBack}
    />
  );
}
