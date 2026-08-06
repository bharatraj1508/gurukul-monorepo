import { PERMS } from '../registry';
import { DefaultRoleDefinition } from '../types';

// Student — learner self-service.
// Can only view own data across all relevant modules.
export const studentRole: DefaultRoleDefinition = {
  title: 'Student',
  isAdmin: false,
  rank: 7,
  scopes: [
    // Dashboard — own
    PERMS.dashboard.viewOwn.id,
    // Academics — view own enrolled
    PERMS.course.viewOwn.id,
    PERMS.class.viewOwn.id,
    // People — view own profile
    PERMS.student.viewOwn.id,
    // Operations — view own
    PERMS.enrolment.viewOwn.id,
    PERMS.fee.viewOwn.id,
    PERMS.attendance.viewOwn.id,
    // Assessment — view own
    PERMS.grade.viewOwn.id,
    // Announcements — view
    PERMS.announcement.view.id,
    // Library — view catalog
    PERMS.library.view.id,
    PERMS.notice.view.id,
  ],
};
