import { PERMS } from '../registry';
import { DefaultRoleDefinition } from '../types';

// Coordinators — high-level academic/administrative coordinator.
// Full access to academics, people, operations, assessment, library, and reporting.
export const coordinators: DefaultRoleDefinition = {
  title: 'Coordinators',
  isAdmin: false,
  rank: 3,
  scopes: [
    // Dashboard
    PERMS.dashboard.all.id,
    // Academics
    PERMS.academicTerm.all.id,
    PERMS.program.all.id,
    PERMS.course.all.id,
    PERMS.class.all.id,
    PERMS.instructor.all.id,
    // People
    PERMS.student.all.id,
    PERMS.parent.all.id,
    PERMS.teacher.view.id,
    PERMS.user.view.id,
    PERMS.user.invite.id,
    PERMS.user.edit.id,
    PERMS.user.suspend.id,
    // Operations
    PERMS.enrolment.all.id,
    PERMS.fee.all.id,
    PERMS.attendance.all.id,
    PERMS.library.all.id,
    // Announcements
    PERMS.announcement.view.id,
    PERMS.announcement.viewAll.id,
    PERMS.announcement.create.id,
    PERMS.announcement.editOwn.id,
    PERMS.announcement.deleteOwn.id,
    // Assessment
    PERMS.grade.all.id,
    // Analytics
    PERMS.report.view.id,
    // Admin
    PERMS.role.view.id,
    PERMS.tenant.view.id,
    PERMS.notice.all.id,
  ],
};
