import { beforeEach, describe, expect, it } from 'vitest';

import { getDb, inboxForUser } from '../src/mocks/db';
import {
  emitDeliberationClosed,
  emitMessageMentions,
  emitProposalComment,
  emitThreadReply,
} from '../src/mocks/inboxEmit';
import { seed } from '../src/mocks/seed';

let counter = 0;
const ctx = {
  nowIso: '2026-05-21T12:00:00.000Z',
  idFor: () => `ix-test-${++counter}`,
};

beforeEach(() => {
  seed({ identityKey: 'marina' });
  counter = 0;
});

describe('emitMessageMentions', () => {
  it('creates a mention item for each named user, skipping the actor', () => {
    const message = {
      id: 'm-test-1',
      conversationId: 'ch-vmc-general',
      parentMessageId: null,
      authorId: 'u-pedro',
      body: 'Hey @u-marina and @u-claudia — anyone seen @u-pedro? :)',
      attachments: [],
      createdAt: ctx.nowIso,
      editedAt: null,
    };
    emitMessageMentions(message, ctx);
    const marina = inboxForUser('u-marina').filter(
      (i) => i.kind === 'mention' && i.id.startsWith('ix-test'),
    );
    const claudia = inboxForUser('u-claudia').filter(
      (i) => i.kind === 'mention' && i.id.startsWith('ix-test'),
    );
    const pedro = inboxForUser('u-pedro').filter((i) => i.id.startsWith('ix-test'));
    expect(marina).toHaveLength(1);
    expect(claudia).toHaveLength(1);
    expect(pedro).toHaveLength(0);
  });

  it('ignores unknown user ids in the mention list', () => {
    const message = {
      id: 'm-test-2',
      conversationId: 'ch-vmc-general',
      parentMessageId: null,
      authorId: 'u-pedro',
      body: '@u-nobody @u-also-nobody @u-marina',
      attachments: [],
      createdAt: ctx.nowIso,
      editedAt: null,
    };
    emitMessageMentions(message, ctx);
    const newItems = inboxForUser('u-marina').filter((i) => i.id.startsWith('ix-test'));
    expect(newItems).toHaveLength(1);
  });

  it('does nothing for messages in a DM (no project)', () => {
    const message = {
      id: 'm-test-3',
      conversationId: 'dm-marina-pedro',
      parentMessageId: null,
      authorId: 'u-pedro',
      body: '@u-marina did you see this?',
      attachments: [],
      createdAt: ctx.nowIso,
      editedAt: null,
    };
    const before = inboxForUser('u-marina').length;
    emitMessageMentions(message, ctx);
    expect(inboxForUser('u-marina').length).toBe(before);
  });
});

describe('emitProposalComment', () => {
  it('notifies the proposal author when someone else comments', () => {
    const proposal = getDb().proposals.get('pr-bike-racks')!;
    const comment = {
      id: 'c-test-1',
      proposalId: proposal.id,
      authorId: 'u-pedro',
      body: 'Could we get a third quote?',
      createdAt: ctx.nowIso,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    };
    emitProposalComment(comment, ctx);
    // Claudia is the author of pr-bike-racks
    const claudia = inboxForUser('u-claudia').filter((i) => i.id.startsWith('ix-test'));
    expect(claudia).toHaveLength(1);
    expect(claudia[0]?.kind).toBe('comment-on-yours');
  });

  it('does nothing when the commenter IS the proposal author', () => {
    const proposal = getDb().proposals.get('pr-bike-racks')!;
    const comment = {
      id: 'c-test-2',
      proposalId: proposal.id,
      authorId: proposal.authorId,
      body: 'Self-comment.',
      createdAt: ctx.nowIso,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    };
    const before = inboxForUser(proposal.authorId).length;
    emitProposalComment(comment, ctx);
    expect(inboxForUser(proposal.authorId).length).toBe(before);
  });

  it('emits an additional mention item for users named in the comment', () => {
    const proposal = getDb().proposals.get('pr-bike-racks')!;
    const comment = {
      id: 'c-test-3',
      proposalId: proposal.id,
      authorId: 'u-pedro',
      body: '@u-helena should weigh in here.',
      createdAt: ctx.nowIso,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    };
    emitProposalComment(comment, ctx);
    const helena = inboxForUser('u-helena').filter((i) => i.id.startsWith('ix-test'));
    expect(helena).toHaveLength(1);
    expect(helena[0]?.kind).toBe('mention');
  });
});

describe('emitDeliberationClosed', () => {
  it('issues one proposal-closed item per decisive voter (abstainers skipped)', () => {
    // pr-bike-racks has 8 decisive + 1 abstain (Marina). 9 voters total.
    const root = getDb().proposals.get('pr-bike-racks')!;
    emitDeliberationClosed(root, 'pr-bike-racks', ctx);
    const counts: Record<string, number> = {};
    for (const userId of [
      'u-pedro',
      'u-claudia',
      'u-bruno',
      'u-tiago',
      'u-ines',
      'u-rui',
      'u-helena',
      'u-sofia',
    ]) {
      counts[userId] = inboxForUser(userId).filter((i) => i.id.startsWith('ix-test')).length;
    }
    expect(Object.values(counts).every((n) => n === 1)).toBe(true);
    // Marina abstained → no item
    expect(inboxForUser('u-marina').filter((i) => i.id.startsWith('ix-test'))).toHaveLength(0);
  });

  it('also emits document-amended when the winner is a Document proposal', () => {
    const root = getDb().proposals.get('pr-house-rules-v2')!;
    // pr-house-rules-v2 had 7 votes; 1 abstain → 6 decisive.
    emitDeliberationClosed(root, 'pr-house-rules-v2', ctx);
    // Pedro voted decisively → should have both kinds
    const items = inboxForUser('u-pedro').filter((i) => i.id.startsWith('ix-test'));
    expect(items.map((i) => i.kind).sort()).toEqual(['document-amended', 'proposal-closed']);
  });
});

describe('emitThreadReply', () => {
  it('notifies the parent author + other thread participants, skipping self', () => {
    const reply = {
      id: 'm-test-reply',
      conversationId: 'ch-vmc-bikes',
      parentMessageId: 'm-b-1',
      authorId: 'u-rui',
      body: 'oh!',
      attachments: [],
      createdAt: ctx.nowIso,
      editedAt: null,
    };
    emitThreadReply(reply, ctx);
    // m-b-1 author is u-claudia, replies in the thread are by u-claudia/u-pedro/u-helena
    const seen = new Set<string>();
    for (const userId of ['u-claudia', 'u-pedro', 'u-helena']) {
      const items = inboxForUser(userId).filter((i) => i.id.startsWith('ix-test'));
      if (items.length > 0) seen.add(userId);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
    // Rui (the actor) does NOT get a reply item for their own reply
    expect(inboxForUser('u-rui').filter((i) => i.id.startsWith('ix-test'))).toHaveLength(0);
  });
});
