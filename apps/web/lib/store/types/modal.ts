import { type AcademicTerm } from '@/services/api/requests/academic-terms';
import { type Class } from '@/services/api/requests/classes';
import { type Course } from '@/services/api/requests/courses';
import { type Diary } from '@/services/api/requests/diary';
import { type ParentListItem } from '@/services/api/requests/parents';
import { type Program } from '@/services/api/requests/programs';
import { type Role } from '@/services/api/requests/roles';
import {
  type Student,
  type StudentListItem,
} from '@/services/api/requests/students';

// Add every modal you register, in declaration order.
// `None` MUST be the first/zero value — it's the closed state.
export enum ModalType {
  None,
  ExampleDeletion,
  InviteMemberModal,
  RoleModal,
  RevokeAccessModal,
  DeleteModal,
  AcademicTermModal,
  MemberProfileModal,
  ChangeRoleModal,
  SuspendMemberModal,
  ProgramModal,
  ClassModal,
  CourseModal,
  StudentModal,
  StudentStatusModal,
  StudentProfileModal,
  BulkImportModal,
  ParentModal,
  ParentProfileModal,
  EnrolStudentModal,
  BulkEnrolModal,
  AssignInstructorModal,
  ManageInstructorCoursesModal,
  LinkParentModal,
  EditParentLinkModal,
  TeacherProfileModal,
  DiaryModal,
}

// Union of every modal's payload shape. Each member should ideally
// come from its modal's own `types.ts` so payloads stay co-located.
export type ModalPayload =
  | Record<string, never> // for modals with no payload
  | { presetRoleName?: string } // InviteMemberModal payload
  | { id: string } // ExampleDeletion
  | { editingRole: Role | null } // RoleModal
  | { editingTerm: AcademicTerm | null } // AcademicTermModal
  | { membershipId: string; userFullName: string } // RevokeAccessModal / SuspendMemberModal
  | { membershipId: string } // MemberProfileModal
  | { membershipId: string; currentRoleIds: string[]; userFullName: string } // ChangeRoleModal
  | { editingProgram: Program | null } // ProgramModal
  | { editingClass: Class | null } // ClassModal
  | { editingCourse: Course | null } // CourseModal
  | { editingStudent: StudentListItem | null } // StudentModal
  | { student: Student } // StudentStatusModal
  | { studentId: string } // StudentProfileModal
  | { entity: 'student' | 'parent' } // BulkImportModal
  | { studentId: string } // StudentProfileModal / LinkParentModal
  | {
      studentId: string;
      parentId: string;
      currentRelationship: string;
      currentDescription?: string | null;
    } // EditParentLinkModal
  | { editingParent: ParentListItem | null } // ParentModal
  | { parentId: string } // ParentProfileModal
  | { teacherId: string } // TeacherProfileModal
  | { editingDiary: Diary | null; presetClassId?: string } // DiaryModal
  | { classId: string } // EnrolStudentModal / BulkEnrolModal / AssignInstructorModal
  | {
      classId: string;
      classInstructorId: string;
      teacherName: string;
      currentCourseIds: string[];
    } // ManageInstructorCoursesModal
  | { membershipId: string; userFullName: string } // RevokeAccessModal
  | {
      title: string;
      subtitle: string;
      confirmButtonText?: string;
      onConfirm: () => void | Promise<void>;
    }; // DeleteModal

export type ModalState = {
  type: ModalType;
  payload: ModalPayload;
};
