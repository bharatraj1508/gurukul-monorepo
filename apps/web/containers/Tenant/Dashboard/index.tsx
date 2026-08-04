'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Sparkles, Megaphone, BellRing, ChevronRight, ArrowUpRight, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  useShowNoticeDetailModal,
  useShowAnnouncementDetailModal,
} from '@/hooks/use-modal';
import { useSubdomain } from '@/hooks/use-subdomain';
import { useCurrentTenant } from '@/services/api/requests/tenants';
import { useCurrentUserProfile } from '@/services/api/requests/users';
import { useNotices, Notice } from '@/services/api/requests/notices';
import { useAnnouncements, Announcement } from '@/services/api/requests/announcements';

export default function TenantDashboard() {
  const { subdomain } = useSubdomain();
  const { data: tenant } = useCurrentTenant();
  const { data: profile } = useCurrentUserProfile();

  const showNoticeDetailModal = useShowNoticeDetailModal();
  const showAnnouncementDetailModal = useShowAnnouncementDetailModal();

  // Fetch active notices (limit to 2 for sidebar)
  const { data: activeNotices, isLoading: isLoadingNotices } = useNotices({ active: 'true' });
  const recentNotices = activeNotices?.slice(0, 2) || [];

  // Fetch active approved announcements (limit to 2 for sidebar)
  const { data: activeAnnouncements, isLoading: isLoadingAnnouncements } = useAnnouncements({
    status: 'APPROVED',
    active: 'true',
  });
  const recentAnnouncements = activeAnnouncements?.slice(0, 2) || [];

  const handleNoticeClick = (notice: Notice) => {
    showNoticeDetailModal(notice);
  };

  const handleAnnouncementClick = (announcement: Announcement) => {
    showAnnouncementDetailModal(announcement);
  };

  const hasAnnouncements = isLoadingAnnouncements || recentAnnouncements.length > 0;
  const hasNotices = isLoadingNotices || recentNotices.length > 0;
  const hasRightSidebar = hasAnnouncements || hasNotices;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back{profile ? `, ${profile.firstName}` : ''}!
          </h1>
          <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Managing workspace:{' '}
          <span className="font-semibold text-primary">
            {tenant?.name || subdomain || 'gurukul'}
          </span>
        </p>
      </div>

      {/* Main Layout Grid with Right-hand Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Main Area) */}
        <div className={hasRightSidebar ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          {/* Main workspace widgets can be rendered here */}
        </div>

        {/* Right Column (Communications Sidebar) */}
        {hasRightSidebar && (
          <div className="space-y-6 w-full lg:col-span-1">
            {/* Announcements Section - Hidden completely if no announcements */}
            {hasAnnouncements && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500 text-white">
                      <BellRing className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                      School Announcements
                    </h3>
                  </div>
                  <Link
                    href="/announcements"
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    View all <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="p-3 space-y-3">
                  {isLoadingAnnouncements ? (
                    <div className="space-y-2">
                      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />
                      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />
                    </div>
                  ) : (
                    recentAnnouncements.map((announcement) => (
                      <div
                        key={announcement.id}
                        onClick={() => handleAnnouncementClick(announcement)}
                        className="p-3.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 cursor-pointer transition-all duration-150 group space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] py-0 px-2 font-medium"
                          >
                            School Wide
                          </Badge>
                          <span className="text-[11px] text-zinc-400">
                            Until {format(new Date(announcement.endDate), 'MMM d')}
                          </span>
                        </div>

                        <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                          {announcement.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                          <span className="truncate max-w-[130px] flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {announcement.creator ? announcement.creator.firstName : 'School'}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
                            Read <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Notices Section - Hidden completely if no notices */}
            {hasNotices && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary text-primary-foreground">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                      Class Notices
                    </h3>
                  </div>
                  <Link
                    href="/notices"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
                  >
                    View all <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="p-3 space-y-3">
                  {isLoadingNotices ? (
                    <div className="space-y-2">
                      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />
                      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />
                    </div>
                  ) : (
                    recentNotices.map((notice) => (
                      <div
                        key={notice.id}
                        onClick={() => handleNoticeClick(notice)}
                        className="p-3.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-150 group space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase py-0 px-2 font-medium"
                          >
                            {notice.scope.replace('_', ' ')}
                          </Badge>
                          <span className="text-[11px] text-zinc-400">
                            Until {format(new Date(notice.endDate), 'MMM d')}
                          </span>
                        </div>

                        <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {notice.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                          <span className="truncate max-w-[130px] flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {notice.creator ? notice.creator.firstName : 'Teacher'}
                          </span>
                          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
                            Read <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
