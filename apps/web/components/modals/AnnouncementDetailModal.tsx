'use client';

import { format } from 'date-fns';
import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import { Announcement } from '@/services/api/requests/announcements';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { Calendar, User, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useHideModal } from '@/hooks/use-modal';

interface AnnouncementDetailModalProps {
  announcement?: Announcement | null;
}

export function AnnouncementDetailModal({ announcement = null }: AnnouncementDetailModalProps) {
  const hideModal = useHideModal();

  if (!announcement) return null;

  const now = new Date();
  const startDate = new Date(announcement.startDate);
  const endDate = new Date(announcement.endDate);

  const statusColors = {
    APPROVED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950',
    PENDING_APPROVAL: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950',
    REJECTED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950',
  };

  const StatusIcon = {
    APPROVED: CheckCircle2,
    PENDING_APPROVAL: Clock,
    REJECTED: XCircle,
  }[announcement.status];

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={announcement.title}
      description={
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={cn("border-none flex gap-1 text-[10px]", statusColors[announcement.status])}>
            <StatusIcon className="w-3 h-3" />
            {announcement.status.replace('_', ' ')}
          </Badge>
          <span className="text-xs text-zinc-500">School-wide Announcement</span>
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 opacity-70" />
            <span>Author: {announcement.creator ? `${announcement.creator.firstName} ${announcement.creator.lastName}` : 'System'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-70" />
            <span>Active: {format(startDate, 'MMM d, yyyy h:mm a')} &rarr; {format(endDate, 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>

        {announcement.status === 'REJECTED' && announcement.rejectionReason && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" /> Rejection Feedback from Principal:
            </p>
            <p className="pl-5 italic">{announcement.rejectionReason}</p>
          </div>
        )}

        <div className="py-2">
          <RichTextContent html={announcement.content} />
        </div>
      </div>
    </Modal>
  );
}
