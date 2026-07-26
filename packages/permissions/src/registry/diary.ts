import { FeatureDefinition, PermissionEntry, id } from '../types';

const view: PermissionEntry = {
  id: id('view-diary'),
  feature: 'diary',
  kind: 'view',
  label: 'View all work diary notes',
  ownership: 'all',
  ownershipFor: 'diary',
};

const viewOwn: PermissionEntry = {
  id: id('view-own-diary'),
  feature: 'diary',
  kind: 'view-own',
  label: 'View own work diary notes',
  ownership: 'own',
  ownershipFor: 'diary',
};

const create: PermissionEntry = {
  id: id('create-diary'),
  feature: 'diary',
  kind: 'create',
  label: 'Create work diary notes',
};

const edit: PermissionEntry = {
  id: id('edit-diary'),
  feature: 'diary',
  kind: 'edit',
  label: 'Edit work diary notes',
};

const deletePerm: PermissionEntry = {
  id: id('delete-diary'),
  feature: 'diary',
  kind: 'delete',
  label: 'Delete work diary notes',
};

const all: PermissionEntry = {
  id: id('all-diary'),
  feature: 'diary',
  kind: 'all',
  label: 'All',
  grants: [view.id, viewOwn.id, create.id, edit.id, deletePerm.id],
};

export const diaryFeature: FeatureDefinition = {
  key: 'diary',
  title: 'Work Diary',
  iconName: 'ClipboardList',
  editorCategory: 'Academics',
  all,
  permissions: {
    [all.id]: all,
    [view.id]: view,
    [viewOwn.id]: viewOwn,
    [create.id]: create,
    [edit.id]: edit,
    [deletePerm.id]: deletePerm,
  },
};
