// Core types for the permission registry.
// Both backend (NestJS) and frontend (Next.js) import these via the compiled package.

// Branded string: callers cannot pass arbitrary strings where a PermissionId is required.
// Brand is erased at runtime — these are plain strings in the database and on the wire.
export type PermissionId = string & { readonly __brand: 'PermissionId' };

// Stable feature keys. Used for grouping in the role editor + sidebar checks.
export type FeatureKey =
  | 'dashboard'
  | 'academicTerm'
  | 'program'
  | 'course'
  | 'class'
  | 'instructor'
  | 'student'
  | 'parent'
  | 'teacher'
  | 'enrolment'
  | 'fee'
  | 'attendance'
  | 'grade'
  | 'library'
  | 'user'
  | 'role'
  | 'tenant'
  | 'appearance'
  | 'report'
  | 'notice'
  | 'announcement';

// The bucket the role editor UI renders each feature into.
export type EditorCategory =
  | 'Academics'
  | 'People'
  | 'Operations'
  | 'Assessment'
  | 'Admin'
  | 'Analytics';

// Icon name tokens. The shared package cannot import React/lucide-react,
// so we hand tokens to the frontend and let it map to components.
export type IconName =
  | 'LayoutDashboard'
  | 'Calendar'
  | 'GraduationCap'
  | 'BookOpen'
  | 'School'
  | 'UserCheck'
  | 'Users'
  | 'UserPlus'
  | 'ClipboardList'
  | 'CreditCard'
  | 'CheckSquare'
  | 'Award'
  | 'Library'
  | 'UserCog'
  | 'Shield'
  | 'Settings'
  | 'BarChart3'
  | 'Megaphone';

// Classification used by the role editor and by view-scope detection.
// 'view'      — read-all access for the entity
// 'view-own'  — read-only of resources the user owns/is assigned to
// 'all'       — superset; holding it grants every other entry in the same feature
// 'custom'    — non-CRUD action specific to a feature (reserved for future use)
export type PermissionKind =
  | 'all'
  | 'view'
  | 'view-own'
  | 'create'
  | 'edit'
  | 'delete'
  | 'custom';

export interface PermissionEntry {
  readonly id: PermissionId;
  readonly feature: FeatureKey;
  readonly label: string;
  readonly description?: string;
  readonly kind: PermissionKind;
  // Present on superset entries ('all-*'). Holding this id grants every listed child id at runtime.
  readonly grants?: readonly PermissionId[];
  // View-pair metadata. When both 'all' + 'own' ownership entries exist with the same
  // ownershipFor, getViewScope() can auto-derive their relationship from the registry.
  readonly ownership?: 'all' | 'own';
  readonly ownershipFor?: string;
}

export interface FeatureDefinition {
  readonly key: FeatureKey;
  readonly title: string;
  readonly iconName: IconName;
  readonly editorCategory: EditorCategory;
  readonly permissions: Readonly<Record<string, PermissionEntry>>;
  // Convenience pointer to the all-* permission for this feature.
  readonly all: PermissionEntry;
}

export interface DefaultRoleDefinition {
  readonly title: string;
  readonly isAdmin: boolean;
  readonly rank: number;
  readonly scopes: readonly PermissionId[];
}

// Cast a literal string to a PermissionId. Exists so feature files can be terse.
// Validity is enforced by the registry-shape test, not the type system.
export function id(s: string): PermissionId {
  return s as PermissionId;
}
