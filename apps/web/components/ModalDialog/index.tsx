'use client';

import { Fragment } from 'react';

import { AcademicTermModal } from '@/components/modals/AcademicTermModal';
import { AssignInstructorModal } from '@/components/modals/AssignInstructorModal';
import { BulkEnrolModal } from '@/components/modals/BulkEnrolModal';
import { BulkImportModal } from '@/components/modals/BulkImportModal';
import { ChangeRoleModal } from '@/components/modals/ChangeRoleModal';
import DeleteModal from '@/components/modals/Confirmations/DeleteModal';
import ExampleDeletion from '@/components/modals/Confirmations/ExampleDeletion';
import RevokeAccessModal from '@/components/modals/Confirmations/RevokeAccess';
import SuspendMemberModal from '@/components/modals/Confirmations/SuspendMember';
import { EditParentLinkModal } from '@/components/modals/EditParentLinkModal';
import { EnrolStudentModal } from '@/components/modals/EnrolStudentModal';
import { InviteMemberModal } from '@/components/modals/InviteMemberModal';
import { LinkParentModal } from '@/components/modals/LinkParentModal';
import { ManageInstructorCoursesModal } from '@/components/modals/ManageInstructorCoursesModal';
import { MemberProfileModal } from '@/components/modals/MemberProfileModal';
import { ParentModal } from '@/components/modals/ParentModal';
import { ParentProfileModal } from '@/components/modals/ParentProfileModal';
import { ProgramModal } from '@/components/modals/ProgramModal';
import { RoleModal } from '@/components/modals/RoleModal';
import { StudentModal } from '@/components/modals/StudentModal';
import { StudentProfileModal } from '@/components/modals/StudentProfileModal';
import { StudentStatusModal } from '@/components/modals/StudentStatusModal';
import { TeacherProfileModal } from '@/components/modals/TeacherProfileModal';
import { NoticeModal } from '@/components/modals/NoticeModal';
import { NoticeDetailModal } from '@/components/modals/NoticeDetailModal';
import { AnnouncementModal } from '@/components/modals/AnnouncementModal';
import { AnnouncementDetailModal } from '@/components/modals/AnnouncementDetailModal';
import { ApproveRejectAnnouncementModal } from '@/components/modals/ApproveRejectAnnouncementModal';
import { useModalPayload, useModalType } from '@/hooks/use-modal';
import { ModalType } from '@/lib/store/types/modal';

import { ClassModal } from '../modals/ClassModal';
import { CourseModal } from '../modals/CourseModal';

// Registry: one line per modal. React.ComponentType<any> is intentional —
// each modal narrows its own payload type internally.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const Modal: { [key in ModalType]?: React.ComponentType<any> } = {
  [ModalType.None]: Fragment,
  [ModalType.ExampleDeletion]: ExampleDeletion,
  [ModalType.InviteMemberModal]: InviteMemberModal,
  [ModalType.RoleModal]: RoleModal,
  [ModalType.RevokeAccessModal]: RevokeAccessModal,
  [ModalType.DeleteModal]: DeleteModal,
  [ModalType.AcademicTermModal]: AcademicTermModal,
  [ModalType.MemberProfileModal]: MemberProfileModal,
  [ModalType.ChangeRoleModal]: ChangeRoleModal,
  [ModalType.SuspendMemberModal]: SuspendMemberModal,
  [ModalType.ProgramModal]: ProgramModal,
  [ModalType.ClassModal]: ClassModal,
  [ModalType.CourseModal]: CourseModal,
  [ModalType.StudentModal]: StudentModal,
  [ModalType.StudentStatusModal]: StudentStatusModal,
  [ModalType.StudentProfileModal]: StudentProfileModal,
  [ModalType.BulkImportModal]: BulkImportModal,
  [ModalType.ParentModal]: ParentModal,
  [ModalType.ParentProfileModal]: ParentProfileModal,
  [ModalType.EnrolStudentModal]: EnrolStudentModal,
  [ModalType.BulkEnrolModal]: BulkEnrolModal,
  [ModalType.AssignInstructorModal]: AssignInstructorModal,
  [ModalType.ManageInstructorCoursesModal]: ManageInstructorCoursesModal,
  [ModalType.LinkParentModal]: LinkParentModal,
  [ModalType.EditParentLinkModal]: EditParentLinkModal,
  [ModalType.TeacherProfileModal]: TeacherProfileModal,
  [ModalType.NoticeModal]: NoticeModal,
  [ModalType.NoticeDetailModal]: NoticeDetailModal,
  [ModalType.AnnouncementModal]: AnnouncementModal,
  [ModalType.AnnouncementDetailModal]: AnnouncementDetailModal,
  [ModalType.ApproveRejectAnnouncementModal]: ApproveRejectAnnouncementModal,
};

export default function ModalDialog() {
  const modalType = useModalType();
  const modalPayload = useModalPayload();

  const CurrentModal = Modal[modalType];
  if (!CurrentModal) return null;

  return <CurrentModal {...(modalPayload || {})} />;
}
