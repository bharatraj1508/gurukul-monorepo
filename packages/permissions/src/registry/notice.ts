import { FeatureDefinition, PermissionEntry, id } from '../types';

// -----------------------------------------------------------------------
// Notice permissions
// Three scopes of notice creation:
//   CLASS        → any instructor of the target class(es)
//   TEACHERS_ONLY → coordinator / admin / HOD only
//   SCHOOL_WIDE  → coordinator / admin only
// -----------------------------------------------------------------------

const viewOwn: PermissionEntry = {
  id: id('view-notices'),
  feature: 'notice',
  kind: 'view-own',
  label: 'View notices (own scope)',
  description:
    'View notices relevant to the user — their own class notices, ' +
    'teacher-only notices (if a teacher), and school-wide notices.',
  ownership: 'own',
  ownershipFor: 'notice',
};

const viewAll: PermissionEntry = {
  id: id('view-all-notices'),
  feature: 'notice',
  kind: 'view',
  label: 'View all notices',
  description: 'View all notices across the tenant (admin/coordinator).',
  ownership: 'all',
  ownershipFor: 'notice',
};

const createClass: PermissionEntry = {
  id: id('create-class-notice'),
  feature: 'notice',
  kind: 'create',
  label: 'Create class notice',
  description:
    'Create a notice targeted at one or more classes the user instructs.',
};

const createTeacher: PermissionEntry = {
  id: id('create-teacher-notice'),
  feature: 'notice',
  kind: 'create',
  label: 'Create teacher-only notice',
  description: 'Create a notice visible only to all teachers in the tenant.',
};

const createSchool: PermissionEntry = {
  id: id('create-school-notice'),
  feature: 'notice',
  kind: 'create',
  label: 'Create school-wide notice',
  description:
    'Create a notice visible to everyone in the tenant.',
};

const editOwn: PermissionEntry = {
  id: id('edit-own-notice'),
  feature: 'notice',
  kind: 'edit',
  label: 'Edit own notice',
  description: 'Edit a notice created by the current user.',
};

const deleteOwn: PermissionEntry = {
  id: id('delete-own-notice'),
  feature: 'notice',
  kind: 'delete',
  label: 'Delete own notice',
  description: 'Soft-delete a notice created by the current user.',
};

const manage: PermissionEntry = {
  id: id('manage-notices'),
  feature: 'notice',
  kind: 'edit',
  label: 'Manage all notices',
  description:
    'Edit and delete any notice in the tenant regardless of author.',
};

const all: PermissionEntry = {
  id: id('all-notice'),
  feature: 'notice',
  kind: 'all',
  label: 'All notice permissions',
  grants: [
    viewOwn.id,
    viewAll.id,
    createClass.id,
    createTeacher.id,
    createSchool.id,
    editOwn.id,
    deleteOwn.id,
    manage.id,
  ],
};

export const noticeFeature: FeatureDefinition = {
  key: 'notice',
  title: 'Notices',
  iconName: 'Megaphone',
  editorCategory: 'Operations',
  all,
  permissions: {
    [all.id]: all,
    [viewOwn.id]: viewOwn,
    [viewAll.id]: viewAll,
    [createClass.id]: createClass,
    [createTeacher.id]: createTeacher,
    [createSchool.id]: createSchool,
    [editOwn.id]: editOwn,
    [deleteOwn.id]: deleteOwn,
    [manage.id]: manage,
  },
};
