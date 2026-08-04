import { FeatureDefinition, PermissionEntry, id } from '../types';

const view: PermissionEntry = {
  id: id('view-announcements'),
  feature: 'announcement',
  kind: 'view-own',
  label: 'View published announcements',
  description: 'View active school announcements on the dashboard.',
  ownership: 'own',
  ownershipFor: 'announcement',
};

const viewAll: PermissionEntry = {
  id: id('view-all-announcements'),
  feature: 'announcement',
  kind: 'view',
  label: 'View all announcements',
  description: 'View all announcements including pending and rejected.',
  ownership: 'all',
  ownershipFor: 'announcement',
};

const create: PermissionEntry = {
  id: id('create-announcement'),
  feature: 'announcement',
  kind: 'create',
  label: 'Create announcement',
  description: 'Create a school-wide announcement for principal approval.',
};

const approve: PermissionEntry = {
  id: id('approve-announcement'),
  feature: 'announcement',
  kind: 'custom',
  label: 'Approve or reject announcements',
  description: 'Review, approve, or reject pending school announcements.',
};

const editOwn: PermissionEntry = {
  id: id('edit-own-announcement'),
  feature: 'announcement',
  kind: 'edit',
  label: 'Edit own announcement',
  description: 'Edit an announcement created by the user before approval.',
};

const deleteOwn: PermissionEntry = {
  id: id('delete-own-announcement'),
  feature: 'announcement',
  kind: 'delete',
  label: 'Delete own announcement',
  description: 'Delete an announcement created by the user.',
};

const manage: PermissionEntry = {
  id: id('manage-announcements'),
  feature: 'announcement',
  kind: 'edit',
  label: 'Manage all announcements',
  description: 'Edit and delete any announcement in the tenant.',
};

const all: PermissionEntry = {
  id: id('all-announcement'),
  feature: 'announcement',
  kind: 'all',
  label: 'All announcement permissions',
  grants: [
    view.id,
    viewAll.id,
    create.id,
    approve.id,
    editOwn.id,
    deleteOwn.id,
    manage.id,
  ],
};

export const announcementFeature: FeatureDefinition = {
  key: 'announcement',
  title: 'Announcements',
  iconName: 'Megaphone',
  editorCategory: 'Operations',
  all,
  permissions: {
    [all.id]: all,
    [view.id]: view,
    [viewAll.id]: viewAll,
    [create.id]: create,
    [approve.id]: approve,
    [editOwn.id]: editOwn,
    [deleteOwn.id]: deleteOwn,
    [manage.id]: manage,
  },
};
