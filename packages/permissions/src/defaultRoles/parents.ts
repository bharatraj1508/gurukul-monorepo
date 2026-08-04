import { PERMS } from '../registry';
import { DefaultRoleDefinition } from '../types';

// Parents / Guardian — can view linked student's data and communicate.
export const parentsRole: DefaultRoleDefinition = {
  title: 'Parents',
  isAdmin: false,
  rank: 8,
  scopes: [
    // Dashboard — own
    PERMS.dashboard.viewOwn.id,
    // People — view own profile + linked students
    PERMS.parent.viewOwn.id,
    PERMS.student.viewOwn.id,
    // Operations — view own linked
    PERMS.fee.viewOwn.id,
    PERMS.attendance.viewOwn.id,
    // Assessment — view own linked
    PERMS.grade.viewOwn.id,
    // Announcements — view
    PERMS.announcement.view.id,
    PERMS.notice.view.id,
  ],
};
