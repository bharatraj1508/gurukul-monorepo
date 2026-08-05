import { FeatureDefinition, PermissionEntry, id } from '../types';

const view: PermissionEntry = {
  id: id('view-timetables'),
  feature: 'timetable',
  kind: 'view',
  label: 'View all timetables',
  description:
    'View every timetable version, any class grid, rooms, and scheduling configuration.',
  ownership: 'all',
  ownershipFor: 'timetable',
};

const viewOwn: PermissionEntry = {
  id: id('view-own-timetable'),
  feature: 'timetable',
  kind: 'view-own',
  label: 'View own timetable',
  description:
    "View one's own published timetable as a student or teacher, or a linked child's as a parent.",
  ownership: 'own',
  ownershipFor: 'timetable',
};

const manage: PermissionEntry = {
  id: id('manage-timetables'),
  feature: 'timetable',
  kind: 'edit',
  label: 'Manage timetables',
  description:
    'Manage rooms, period templates, subject allocations, teacher constraints, substitutions, and edit draft timetables.',
};

const generate: PermissionEntry = {
  id: id('generate-timetables'),
  feature: 'timetable',
  kind: 'custom',
  label: 'Generate timetables',
  description:
    'Run the automatic timetable generator and its preflight checks.',
};

const publish: PermissionEntry = {
  id: id('publish-timetables'),
  feature: 'timetable',
  kind: 'custom',
  label: 'Publish timetables',
  description: 'Publish a draft timetable or roll back to an archived version.',
};

const all: PermissionEntry = {
  id: id('all-timetable'),
  feature: 'timetable',
  kind: 'all',
  label: 'All timetable permissions',
  grants: [view.id, viewOwn.id, manage.id, generate.id, publish.id],
};

export const timetableFeature: FeatureDefinition = {
  key: 'timetable',
  title: 'Timetable',
  iconName: 'Calendar',
  editorCategory: 'Academics',
  all,
  permissions: {
    [all.id]: all,
    [view.id]: view,
    [viewOwn.id]: viewOwn,
    [manage.id]: manage,
    [generate.id]: generate,
    [publish.id]: publish,
  },
};
