'use client';

import { useState } from 'react';
import { useNotices, useDeleteNotice, Notice } from '@/services/api/requests/notices';
import { useCurrentUserProfile } from '@/services/api/requests/users';
import { usePermission } from '@/hooks/use-permission';
import { useShowNoticeModal, useShowNoticeDetailModal } from '@/hooks/use-modal';
import { PERMS } from '@repo/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Megaphone, MoreVertical, Edit, Trash2, Calendar, User, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function TenantNoticesContainer() {
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<string>('ALL');
  
  const showNoticeModal = useShowNoticeModal();
  const showNoticeDetailModal = useShowNoticeDetailModal();

  const { data: profile } = useCurrentUserProfile();

  const { data: notices, isLoading } = useNotices(
    activeTab !== 'ALL' ? { scope: activeTab } : undefined
  );
  
  const { mutateAsync: deleteNotice } = useDeleteNotice();

  const canCreateClass = hasPermission(PERMS.notice.createClass);
  const canCreateTeachers = hasPermission(PERMS.notice.createTeacher);
  const canCreateSchoolWide = hasPermission(PERMS.notice.createSchool);
  const canCreateAny = canCreateClass || canCreateTeachers || canCreateSchoolWide;

  const tabs = [{ id: 'ALL', label: 'All Notices', show: true }];
  if (canCreateClass || hasPermission(PERMS.notice.viewAll)) tabs.push({ id: 'CLASS', label: 'Class', show: true });
  if (canCreateTeachers || hasPermission(PERMS.notice.viewAll)) tabs.push({ id: 'TEACHERS_ONLY', label: 'Teachers Only', show: true });
  if (canCreateSchoolWide || hasPermission(PERMS.notice.viewAll)) tabs.push({ id: 'SCHOOL_WIDE', label: 'School Wide', show: true });

  const handleCreate = () => {
    showNoticeModal(null);
  };

  const handleEdit = (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    showNoticeModal(notice);
  };

  const handleDelete = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this notice?')) {
      try {
        await deleteNotice(notice.id);
        toast.success('Notice deleted successfully');
      } catch {
        toast.error('Failed to delete notice. Please try again.');
      }
    }
  };

  const handleView = (notice: Notice) => {
    showNoticeDetailModal(notice);
  };

  const getStatus = (notice: Notice) => {
    const now = new Date();
    const start = new Date(notice.startDate);
    const end = new Date(notice.endDate);
    if (now < start) return 'UPCOMING';
    if (now > end) return 'EXPIRED';
    return 'ACTIVE';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Notices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage class announcements and school-wide notices.
          </p>
        </div>
        
        {canCreateAny && (
          <Button onClick={handleCreate} className="gap-2 shrink-0 shadow-sm transition-all hover:shadow-md">
            <Plus className="h-4 w-4" />
            Create Notice
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
        <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-800 w-full">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap cursor-pointer",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="pt-2">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : !notices?.length ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Megaphone className="h-8 w-8 text-primary opacity-80" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">No notices found</h3>
            <p className="text-zinc-500 max-w-sm mb-6">
              {activeTab === 'ALL' 
                ? "There are no active announcements. Create a notice to share information." 
                : `There are no ${activeTab.toLowerCase().replace('_', ' ')} notices.`}
            </p>
            {canCreateAny && (
              <Button onClick={handleCreate} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Create Notice
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {notices.map((notice) => {
              const status = getStatus(notice);
              
              const scopeColors: Record<string, string> = {
                CLASS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
                TEACHERS_ONLY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                SCHOOL_WIDE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
              };
            
              const statusColors = {
                UPCOMING: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
                ACTIVE: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
                EXPIRED: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 dark:text-zinc-400',
              };

              const StatusIcon = {
                UPCOMING: Clock,
                ACTIVE: CheckCircle2,
                EXPIRED: XCircle,
              }[status];

              const isOwner = !!notice.createdBy && notice.createdBy === profile?.id;
              const canEditNotice =
                hasPermission(PERMS.notice.viewAll) ||
                hasPermission(PERMS.notice.manage) ||
                (isOwner && hasPermission(PERMS.notice.editOwn));
              const canDeleteNotice =
                hasPermission(PERMS.notice.viewAll) ||
                hasPermission(PERMS.notice.manage) ||
                (isOwner && hasPermission(PERMS.notice.deleteOwn));
              const canManageNotice = canEditNotice || canDeleteNotice;
              
              return (
                <div 
                  key={notice.id}
                  onClick={() => handleView(notice)}
                  className="group relative flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={cn("border-none text-[10px] font-semibold tracking-wider", scopeColors[notice.scope])}>
                          {notice.scope.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={cn("border-none flex gap-1 text-[10px] font-semibold tracking-wider", statusColors[status])}>
                          <StatusIcon className="w-3 h-3" />
                          {status}
                        </Badge>
                      </div>
                      
                      {canManageNotice && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            {canEditNotice && (
                              <DropdownMenuItem onClick={(e) => handleEdit(notice, e)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteNotice && (
                              <DropdownMenuItem onClick={(e) => handleDelete(notice, e)} className="text-red-600 dark:text-red-400">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 mb-2 line-clamp-2 leading-tight">
                      {notice.title}
                    </h3>
                    
                    {notice.scope === 'CLASS' && notice.classes?.length > 0 && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-1">
                        Target: {notice.classes.map(c => c.class.name).join(', ')}
                      </div>
                    )}
                    
                    <div className="mt-auto pt-4 flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{notice.creator ? `${notice.creator.firstName} ${notice.creator.lastName}` : 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(notice.startDate), 'MMM d')} - {format(new Date(notice.endDate), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom indicator bar */}
                  <div className={cn(
                    "h-1 w-full transition-colors",
                    status === 'ACTIVE' ? "bg-emerald-500" : status === 'UPCOMING' ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-700"
                  )} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
