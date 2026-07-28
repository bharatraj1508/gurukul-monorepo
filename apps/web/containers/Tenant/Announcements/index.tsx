'use client';

import { useState } from 'react';
import {
  useAnnouncements,
  useDeleteAnnouncement,
  Announcement,
} from '@/services/api/requests/announcements';
import { useCurrentUserProfile } from '@/services/api/requests/users';
import { usePermission } from '@/hooks/use-permission';
import {
  useShowAnnouncementModal,
  useShowAnnouncementDetailModal,
  useShowApproveRejectAnnouncementModal,
} from '@/hooks/use-modal';
import { PERMS } from '@repo/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  BellRing,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function TenantAnnouncementsContainer() {
  const { hasPermission } = usePermission();
  const { data: profile } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<'PUBLISHED' | 'APPROVAL_QUEUE' | 'MY_SUBMISSIONS'>('PUBLISHED');

  const showAnnouncementModal = useShowAnnouncementModal();
  const showDetailModal = useShowAnnouncementDetailModal();
  const showApproveRejectModal = useShowApproveRejectAnnouncementModal();

  const canCreate = hasPermission(PERMS.announcement.create);
  const canApprove = hasPermission(PERMS.announcement.approve);
  const canViewAll = hasPermission(PERMS.announcement.viewAll);

  // Determine API query params based on tab
  const getQueryParams = () => {
    if (activeTab === 'APPROVAL_QUEUE') {
      return { status: 'PENDING_APPROVAL', active: 'false' };
    }
    if (activeTab === 'MY_SUBMISSIONS') {
      return { active: 'false' };
    }
    return { status: 'APPROVED', active: 'true' };
  };

  const { data: announcements, isLoading } = useAnnouncements(getQueryParams());
  const { mutateAsync: deleteAnnouncement } = useDeleteAnnouncement();

  const handleCreate = () => {
    showAnnouncementModal(null);
  };

  const handleEdit = (announcement: Announcement, e: React.MouseEvent) => {
    e.stopPropagation();
    showAnnouncementModal(announcement);
  };

  const handleDelete = async (announcement: Announcement, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(announcement.id);
        toast.success('Announcement deleted successfully');
      } catch (error) {
        // error handled by mutation hook
      }
    }
  };

  const handleReview = (announcement: Announcement, e: React.MouseEvent) => {
    e.stopPropagation();
    showApproveRejectModal(announcement);
  };

  const handleView = (announcement: Announcement) => {
    showDetailModal(announcement);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BellRing className="h-6 w-6 text-primary" />
            School Announcements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            School-wide communications and principal approval workflow.
          </p>
        </div>

        {canCreate && (
          <Button onClick={handleCreate} className="gap-2 shrink-0 shadow-sm transition-all hover:shadow-md">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
        <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-800 w-full">
          <button
            onClick={() => setActiveTab('PUBLISHED')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap cursor-pointer',
              activeTab === 'PUBLISHED'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Published Announcements
          </button>

          {canApprove && (
            <button
              onClick={() => setActiveTab('APPROVAL_QUEUE')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer',
                activeTab === 'APPROVAL_QUEUE'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Approval Queue</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => setActiveTab('MY_SUBMISSIONS')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap cursor-pointer',
                activeTab === 'MY_SUBMISSIONS'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              My Submissions
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="pt-2">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : !announcements?.length ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <BellRing className="h-8 w-8 text-primary opacity-80" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
              No announcements found
            </h3>
            <p className="text-zinc-500 max-w-sm mb-6">
              {activeTab === 'APPROVAL_QUEUE'
                ? 'All submitted announcements have been reviewed.'
                : activeTab === 'MY_SUBMISSIONS'
                ? 'You have not submitted any announcements.'
                : 'There are currently no active school-wide announcements.'}
            </p>
            {canCreate && (
              <Button onClick={handleCreate} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Submit Announcement
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {announcements.map((announcement) => {
              const statusColors = {
                APPROVED: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
                PENDING_APPROVAL: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
                REJECTED: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
              };

              const StatusIcon = {
                APPROVED: CheckCircle2,
                PENDING_APPROVAL: Clock,
                REJECTED: XCircle,
              }[announcement.status];

              const isOwner = !!announcement.createdBy && announcement.createdBy === profile?.id;
              const canEditAnnouncement =
                canViewAll || (isOwner && hasPermission(PERMS.announcement.editOwn));
              const canDeleteAnnouncement =
                canViewAll || (isOwner && hasPermission(PERMS.announcement.deleteOwn));
              const canManageAnnouncement = canEditAnnouncement || canDeleteAnnouncement;

              return (
                <div
                  key={announcement.id}
                  onClick={() => handleView(announcement)}
                  className="group relative flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-none flex gap-1 text-[10px] font-semibold tracking-wider',
                          statusColors[announcement.status]
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {announcement.status.replace('_', ' ')}
                      </Badge>

                      <div className="flex items-center gap-1">
                        {canApprove && announcement.status === 'PENDING_APPROVAL' && (
                          <Button
                            size="sm"
                            onClick={(e) => handleReview(announcement, e)}
                            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-0"
                          >
                            Review
                          </Button>
                        )}

                        {canManageAnnouncement && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              {canEditAnnouncement && (
                                <DropdownMenuItem onClick={(e) => handleEdit(announcement, e)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                              )}
                              {canDeleteAnnouncement && (
                                <DropdownMenuItem
                                  onClick={(e) => handleDelete(announcement, e)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 mb-2 line-clamp-2 leading-tight">
                      {announcement.title}
                    </h3>

                    {announcement.status === 'REJECTED' && announcement.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 italic line-clamp-2 mb-3 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
                        Reason: {announcement.rejectionReason}
                      </p>
                    )}

                    <div className="mt-auto pt-4 flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>
                          {announcement.creator
                            ? `${announcement.creator.firstName} ${announcement.creator.lastName}`
                            : 'System'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {format(new Date(announcement.startDate), 'MMM d')} -{' '}
                          {format(new Date(announcement.endDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom indicator bar */}
                  <div
                    className={cn(
                      'h-1 w-full transition-colors',
                      announcement.status === 'APPROVED'
                        ? 'bg-emerald-500'
                        : announcement.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
