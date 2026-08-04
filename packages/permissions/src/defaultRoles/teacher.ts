import { PERMS } from '../registry';
import { DefaultRoleDefinition } from '../types';

// Teacher — classroom instructor.
// Views own classes, marks attendance, enters grades for assigned classes.
export const teacher: DefaultRoleDefinition = {
  title: 'Teacher',
  isAdmin: false,
  rank: 6,
  scopes: [
    // Dashboard — own
    PERMS.dashboard.viewOwn.id,
    // Academics — view own assigned
    PERMS.course.viewOwn.id,
    PERMS.class.viewOwn.id,
    // People — view students in own classes
    PERMS.student.view.id,
    PERMS.parent.view.id,
    // Operations — attendance for own classes
    PERMS.attendance.view.id,
    PERMS.attendance.mark.id,
    PERMS.attendance.edit.id,
    // Announcements — view
    PERMS.announcement.view.id,
    // Assessment — grades for own classes
    PERMS.grade.view.id,
    PERMS.grade.enter.id,
    PERMS.grade.edit.id,
    // Library — view
    PERMS.library.view.id,
    PERMS.notice.view.id,
    PERMS.notice.createClass.id,
    PERMS.notice.editOwn.id,
    PERMS.notice.deleteOwn.id,
  ],
};
