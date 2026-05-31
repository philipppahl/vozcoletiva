import { categoriesHandlers } from './categories';
import { commentsHandlers } from './comments';
import { documentsHandlers } from './documents';
import { invitesHandlers } from './invites';
import { meHandlers } from './me';
import { membersHandlers } from './members';
import { projectsHandlers } from './projects';
import { proposalsHandlers } from './proposals';
import { searchHandlers } from './search';
import { votesHandlers } from './votes';

export const handlers = [
  ...meHandlers,
  ...projectsHandlers,
  ...membersHandlers,
  ...invitesHandlers,
  ...proposalsHandlers,
  ...votesHandlers,
  ...commentsHandlers,
  ...documentsHandlers,
  ...searchHandlers,
  ...categoriesHandlers,
];
