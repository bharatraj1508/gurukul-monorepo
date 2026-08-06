import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/store';
import { actions } from '@/lib/store/slices/modal';
import { ModalPayload, ModalType } from '@/lib/store/types/modal';
import { type AcademicTerm } from '@/services/api/requests/academic-terms';
import { type Class } from '@/services/api/requests/classes';
import { type Course } from '@/services/api/requests/courses';
import { type ParentListItem } from '@/services/api/requests/parents';
import { type Program } from '@/services/api/requests/programs';
import { type Role } from '@/services/api/requests/roles';
import {
  type Student,
  type StudentListItem,
} from '@/services/api/requests/students';
import { type Notice } from '@/services/api/requests/notices';
import { type Announcement } from '@/services/api/requests/announcements';

// Generic primitives — every per-modal hook below composes these.
export function useShowModal() {
  const dispatch = useAppDispatch();
  return useCallback(
    (type: ModalType, payload: ModalPayload) =>
      dispatch(actions.showModal({ type, payload })),
    [dispatch],
  );
}

export function useHideModal() {
  const dispatch = useAppDispatch();
  return useCallback(() => dispatch(actions.hideModal()), [dispatch]);
}

export function useModalType() {
  return useAppSelector((state) => state.modal.type);
}

export function useModalPayload() {
  return useAppSelector((state) => state.modal.payload);
}

// Per-modal hooks — one per registered modal. This is the public API
// every feature component should use. Callers never reference
// ModalType directly.
export function useShowExampleDeletionModal(id: string) {
  const showModal = useShowModal();
  return useCallback(
    () => showModal(ModalType.ExampleDeletion, { id }),
    [showModal, id],
  );
}

export function useShowInviteMemberModal() {
  const showModal = useShowModal();
  return useCallback(
    (presetRoleName?: string) =>
      showModal(ModalType.InviteMemberModal, { presetRoleName }),
    [showModal],
  );
}

export function useShowRoleModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingRole: Role | null) =>
      showModal(ModalType.RoleModal, { editingRole }),
    [showModal],
  );
}

export function useShowAcademicTermModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingTerm: AcademicTerm | null) =>
      showModal(ModalType.AcademicTermModal, { editingTerm }),
    [showModal],
  );
}

export function useShowProgramModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingProgram: Program | null) =>
      showModal(ModalType.ProgramModal, { editingProgram }),
    [showModal],
  );
}

export function useShowRevokeAccessModal(
  membershipId: string,
  userFullName: string,
) {
  const showModal = useShowModal();
  return useCallback(
    () =>
      showModal(ModalType.RevokeAccessModal, { membershipId, userFullName }),
    [showModal, membershipId, userFullName],
  );
}

export function useShowDeleteModal() {
  const showModal = useShowModal();
  return useCallback(
    (payload: {
      title: string;
      subtitle: string;
      confirmButtonText?: string;
      onConfirm: () => void | Promise<void>;
    }) => showModal(ModalType.DeleteModal, payload),
    [showModal],
  );
}

export function useShowMemberProfileModal() {
  const showModal = useShowModal();
  return useCallback(
    (membershipId: string) =>
      showModal(ModalType.MemberProfileModal, { membershipId }),
    [showModal],
  );
}

export function useShowChangeRoleModal() {
  const showModal = useShowModal();
  return useCallback(
    (payload: {
      membershipId: string;
      currentRoleIds: string[];
      userFullName: string;
    }) => showModal(ModalType.ChangeRoleModal, payload),
    [showModal],
  );
}

export function useShowSuspendMemberModal() {
  const showModal = useShowModal();
  return useCallback(
    (membershipId: string, userFullName: string) =>
      showModal(ModalType.SuspendMemberModal, { membershipId, userFullName }),
    [showModal],
  );
}

export function useShowClassModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingClass: Class | null) =>
      showModal(ModalType.ClassModal, { editingClass }),
    [showModal],
  );
}

export function useShowCourseModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingCourse: Course | null) =>
      showModal(ModalType.CourseModal, { editingCourse }),
    [showModal],
  );
}

export function useShowStudentModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingStudent: StudentListItem | null) =>
      showModal(ModalType.StudentModal, { editingStudent }),
    [showModal],
  );
}

export function useShowStudentStatusModal() {
  const showModal = useShowModal();
  return useCallback(
    (student: Student) => showModal(ModalType.StudentStatusModal, { student }),
    [showModal],
  );
}

export function useShowStudentProfileModal() {
  const showModal = useShowModal();
  return useCallback(
    (studentId: string) =>
      showModal(ModalType.StudentProfileModal, { studentId }),
    [showModal],
  );
}

export function useShowBulkImportModal() {
  const showModal = useShowModal();
  return useCallback(
    (entity: 'student' | 'parent') =>
      showModal(ModalType.BulkImportModal, { entity }),
    [showModal],
  );
}

export function useShowParentModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingParent: ParentListItem | null) =>
      showModal(ModalType.ParentModal, { editingParent }),
    [showModal],
  );
}

export function useShowParentProfileModal() {
  const showModal = useShowModal();
  return useCallback(
    (parentId: string) => showModal(ModalType.ParentProfileModal, { parentId }),
    [showModal],
  );
}

export function useShowEnrolStudentModal() {
  const showModal = useShowModal();
  return useCallback(
    (classId: string) => showModal(ModalType.EnrolStudentModal, { classId }),
    [showModal],
  );
}

export function useShowBulkEnrolModal() {
  const showModal = useShowModal();
  return useCallback(
    (classId: string) => showModal(ModalType.BulkEnrolModal, { classId }),
    [showModal],
  );
}

export function useShowAssignInstructorModal() {
  const showModal = useShowModal();
  return useCallback(
    (classId: string) =>
      showModal(ModalType.AssignInstructorModal, { classId }),
    [showModal],
  );
}

export function useShowManageInstructorCoursesModal() {
  const showModal = useShowModal();
  return useCallback(
    (payload: {
      classId: string;
      classInstructorId: string;
      teacherName: string;
      currentCourseIds: string[];
    }) => showModal(ModalType.ManageInstructorCoursesModal, payload),
    [showModal],
  );
}

export function useShowLinkParentModal() {
  const showModal = useShowModal();
  return useCallback(
    (studentId: string) => showModal(ModalType.LinkParentModal, { studentId }),
    [showModal],
  );
}

export function useShowTeacherProfileModal() {
  const showModal = useShowModal();
  return useCallback(
    (teacherId: string) =>
      showModal(ModalType.TeacherProfileModal, { teacherId }),
    [showModal],
  );
}

export function useShowEditParentLinkModal() {
  const showModal = useShowModal();
  return useCallback(
    (
      studentId: string,
      parentId: string,
      currentRelationship: string,
      currentDescription?: string | null,
    ) =>
      showModal(ModalType.EditParentLinkModal, {
        studentId,
        parentId,
        currentRelationship,
        currentDescription,
      }),
    [showModal],
  );
}

export function useShowNoticeModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingNotice: Notice | null = null) =>
      showModal(ModalType.NoticeModal, { editingNotice }),
    [showModal],
  );
}

export function useShowNoticeDetailModal() {
  const showModal = useShowModal();
  return useCallback(
    (notice: Notice | null) =>
      showModal(ModalType.NoticeDetailModal, { notice }),
    [showModal],
  );
}

export function useShowAnnouncementModal() {
  const showModal = useShowModal();
  return useCallback(
    (editingAnnouncement: Announcement | null = null) =>
      showModal(ModalType.AnnouncementModal, { editingAnnouncement }),
    [showModal],
  );
}

export function useShowAnnouncementDetailModal() {
  const showModal = useShowModal();
  return useCallback(
    (announcement: Announcement | null) =>
      showModal(ModalType.AnnouncementDetailModal, { announcement }),
    [showModal],
  );
}

export function useShowApproveRejectAnnouncementModal() {
  const showModal = useShowModal();
  return useCallback(
    (announcement: Announcement | null) =>
      showModal(ModalType.ApproveRejectAnnouncementModal, { announcement }),
    [showModal],
  );
}
