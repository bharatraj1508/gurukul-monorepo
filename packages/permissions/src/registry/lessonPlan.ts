import { FeatureDefinition, PermissionEntry, id } from '../types';

// view-own: teacher sees their own plans
const viewOwn: PermissionEntry = {
  id: id('view-own-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'view-own',
  label: 'View own lesson plans',
  description: 'View lesson plans created by the user.',
  ownership: 'own',
  ownershipFor: 'lessonPlan',
};

// view: HoD / Coordinator sees all plans in tenant
const view: PermissionEntry = {
  id: id('view-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'view',
  label: 'View all lesson plans',
  description: 'View all lesson plans across the tenant.',
  ownership: 'all',
  ownershipFor: 'lessonPlan',
};

const create: PermissionEntry = {
  id: id('create-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'create',
  label: 'Create lesson plan',
  description: 'Create a new weekly or monthly lesson plan.',
};

const edit: PermissionEntry = {
  id: id('edit-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'edit',
  label: 'Edit own lesson plan',
  description: 'Edit and submit draft or revision-requested lesson plans.',
};

const approve: PermissionEntry = {
  id: id('approve-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'custom',
  label: 'Approve / request revision for lesson plans',
  description: 'Review, approve, or request revisions for submitted lesson plans.',
};

const deletePerm: PermissionEntry = {
  id: id('delete-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'delete',
  label: 'Delete lesson plan',
  description: 'Soft-delete a draft lesson plan.',
};

const all: PermissionEntry = {
  id: id('all-lesson-plans'),
  feature: 'lessonPlan',
  kind: 'all',
  label: 'All lesson plan permissions',
  grants: [
    viewOwn.id,
    view.id,
    create.id,
    edit.id,
    approve.id,
    deletePerm.id,
  ],
};

export const lessonPlanFeature: FeatureDefinition = {
  key: 'lessonPlan',
  title: 'Lesson Plans',
  iconName: 'Notebook',
  editorCategory: 'Academics',
  all,
  permissions: {
    [all.id]: all,
    [viewOwn.id]: viewOwn,
    [view.id]: view,
    [create.id]: create,
    [edit.id]: edit,
    [approve.id]: approve,
    [deletePerm.id]: deletePerm,
  },
};
