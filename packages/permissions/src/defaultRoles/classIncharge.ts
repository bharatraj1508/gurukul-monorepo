import { PERMS } from '../registry';
import { DefaultRoleDefinition } from '../types';

// Class Incharge — a class teacher responsible for student management,
// attendance, grades, and parent links for their class.
export const classIncharge: DefaultRoleDefinition = {
  title: 'Class Incharge',
  isAdmin: false,
  rank: 5,
  scopes: [
    // Dashboard
    PERMS.dashboard.view.id,
    // Academics
    PERMS.course.view.id,
    PERMS.class.view.id,
    // People
    PERMS.student.view.id,
    PERMS.student.edit.id,
    PERMS.student.linkParent.id,
    PERMS.student.editParentLink.id,
    PERMS.parent.view.id,
    PERMS.parent.edit.id,
    PERMS.teacher.view.id,
    // Operations
    PERMS.enrolment.view.id,
    PERMS.attendance.view.id,
    PERMS.attendance.mark.id,
    PERMS.attendance.edit.id,
    // Assessment
    PERMS.grade.view.id,
    PERMS.grade.enter.id,
    PERMS.grade.edit.id,
    // Library
    PERMS.library.view.id,
    PERMS.notice.view.id,
    PERMS.notice.createClass.id,
    PERMS.notice.editOwn.id,
    PERMS.notice.deleteOwn.id,
  ],
};
