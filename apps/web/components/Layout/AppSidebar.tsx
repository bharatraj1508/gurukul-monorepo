'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { usePermission } from '@/hooks/use-permission';
import { useSubdomain } from '@/hooks/use-subdomain';
import { useAuthUser } from '@/lib/store/auth';
import { useRequestLogout } from '@/services/api/requests/auth';
import { useCurrentTenant } from '@/services/api/requests/tenants';
import { useCurrentUserProfile } from '@/services/api/requests/users';
import {
  BellRing,
  Calendar,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react';

import { PERMS } from '@repo/permissions';

export function AppSidebar() {
  const pathname = usePathname();
  const user = useAuthUser();
  const { subdomain } = useSubdomain();
  const logout = useRequestLogout();
  const { state } = useSidebar();
  const { data: tenant } = useCurrentTenant();
  const { data: profile } = useCurrentUserProfile();
  const { hasPermission } = usePermission();

  const showAllUsers = hasPermission(PERMS.user.view);
  const showStudents = hasPermission(PERMS.student.view);
  const showParents = hasPermission(PERMS.parent.view);
  const showTeachers = hasPermission(PERMS.teacher.view);
  const showDirectory =
    showAllUsers || showStudents || showParents || showTeachers;

  const showTerms = hasPermission(PERMS.academicTerm.view);
  const showPrograms = hasPermission(PERMS.program.view);
  const showCourses =
    hasPermission(PERMS.course.view) || hasPermission(PERMS.course.viewOwn);
  const showClasses =
    hasPermission(PERMS.class.view) || hasPermission(PERMS.class.viewOwn);
  const showAcademics = showTerms || showPrograms || showCourses || showClasses;

  const showNotices =
    hasPermission(PERMS.notice.createClass) ||
    hasPermission(PERMS.notice.viewAll) ||
    hasPermission(PERMS.notice.view);

  const showAnnouncements =
    hasPermission(PERMS.announcement.create) ||
    hasPermission(PERMS.announcement.approve) ||
    hasPermission(PERMS.announcement.viewAll) ||
    hasPermission(PERMS.announcement.view);

  const showCommunications = showNotices || showAnnouncements;

  const [isErpOpen, setIsErpOpen] = useState(pathname.startsWith('/users'));
  const [isAcademicsOpen, setIsAcademicsOpen] = useState(
    pathname.startsWith('/academics'),
  );
  const [isCommunicationsOpen, setIsCommunicationsOpen] = useState(
    pathname.startsWith('/notices') || pathname.startsWith('/announcements'),
  );

  return (
    <Sidebar collapsible="icon" className="!border-r-0">
      <SidebarHeader className="h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground font-bold text-lg">
            G
          </div>
          {state !== 'collapsed' && (
            <div className="flex flex-col text-left leading-none">
              <span
                className="font-semibold text-sm tracking-tight truncate max-w-[130px] text-sidebar-foreground"
                title={tenant?.name || 'Gurukul'}
              >
                {tenant?.name || 'Gurukul'}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase font-medium tracking-wider truncate max-w-[130px]">
                {tenant?.subdomain || subdomain || 'Portal'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarMenu className="px-2 gap-1">
          {/* Dashboard Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard'}
              className="w-full justify-start gap-3 transition-colors"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Directory Collapsible Link */}
          {showDirectory && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsErpOpen((prev) => !prev)}
                className="w-full justify-start gap-3 transition-colors cursor-pointer"
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Directory</span>
                {isErpOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                )}
              </SidebarMenuButton>
              {isErpOpen && state !== 'collapsed' && (
                <SidebarMenuSub className="mt-1 ml-4 pl-3 border-l border-sidebar-border flex flex-col gap-1">
                  {showAllUsers && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === '/users'}
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/users">
                          <span>All Users</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  {showStudents && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/users/students' ||
                          pathname.startsWith('/users/students/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/users/students">
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>Students</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  {showParents && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/users/parents' ||
                          pathname.startsWith('/users/parents/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/users/parents">
                          <Users className="h-3.5 w-3.5" />
                          <span>Parents</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  {showTeachers && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/users/teachers' ||
                          pathname.startsWith('/users/teachers/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/users/teachers">
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Teachers</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )}

          {/* Academics Collapsible Link */}
          {showAcademics && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsAcademicsOpen((prev) => !prev)}
                className="w-full justify-start gap-3 transition-colors cursor-pointer"
              >
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Academics</span>
                {isAcademicsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                )}
              </SidebarMenuButton>
              {isAcademicsOpen && state !== 'collapsed' && (
                <SidebarMenuSub className="mt-1 ml-4 pl-3 border-l border-sidebar-border flex flex-col gap-1">
                  {showTerms && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === '/academics/terms'}
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/academics/terms">
                          <span>Academic Terms</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  {showPrograms && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/academics/programs' ||
                          pathname.startsWith('/academics/programs/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/academics/programs">
                          <span>Academic Programs</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  {showCourses && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/academics/courses' ||
                          pathname.startsWith('/academics/courses/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/academics/courses">
                          <span>Courses</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  {showClasses && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/academics/classes' ||
                          pathname.startsWith('/academics/classes/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/academics/classes">
                          <span>Classes</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )}

          {/* Notices & Announcements Collapsible Link */}
          {showCommunications && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsCommunicationsOpen((prev) => !prev)}
                className="w-full justify-start gap-3 transition-colors cursor-pointer"
              >
                <Megaphone className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Notices & Announcements</span>
                {isCommunicationsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
                )}
              </SidebarMenuButton>
              {isCommunicationsOpen && state !== 'collapsed' && (
                <SidebarMenuSub className="mt-1 ml-4 pl-3 border-l border-sidebar-border flex flex-col gap-1">
                  {showNotices && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/notices' || pathname.startsWith('/notices/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/notices">
                          <Megaphone className="h-3.5 w-3.5" />
                          <span>Class Notices</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  {showAnnouncements && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === '/announcements' ||
                          pathname.startsWith('/announcements/')
                        }
                        className="w-full justify-start gap-2 py-1 px-2 text-xs rounded-md cursor-pointer"
                      >
                        <Link href="/announcements">
                          <BellRing className="h-3.5 w-3.5" />
                          <span>School Announcements</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )}

          {/* Settings Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith('/settings')}
              className="w-full justify-start gap-3 transition-colors"
            >
              <Link href="/settings">
                <Settings className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            {state !== 'collapsed' ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-7 w-7 rounded-full bg-sidebar-primary/20 text-sidebar-primary flex items-center justify-center text-xs font-semibold shrink-0 uppercase">
                    {profile
                      ? profile.firstName.charAt(0)
                      : user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-medium text-sidebar-foreground truncate max-w-[110px]">
                      {profile
                        ? `${profile.firstName} ${profile.lastName}`
                        : user?.email || 'User'}
                    </span>
                    <span
                      className="text-[9px] text-sidebar-foreground/50 truncate max-w-[110px]"
                      title={profile?.email || user?.email || 'Administrator'}
                    >
                      {profile?.email || user?.email || 'Administrator'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  title="Sign out"
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-red-400 transition-colors shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <SidebarMenuButton
                onClick={() => logout.mutate()}
                className="w-full justify-center text-sidebar-foreground/50 hover:text-red-400"
              >
                <LogOut className="h-4 w-4 shrink-0" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
