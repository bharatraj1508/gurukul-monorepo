'use client';

import { format } from 'date-fns';
import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import { Notice } from '@/services/api/requests/notices';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { Calendar, User, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useHideModal } from '@/hooks/use-modal';

interface NoticeDetailModalProps {
  notice?: Notice | null;
}

export function NoticeDetailModal({ notice = null }: NoticeDetailModalProps) {
  const hideModal = useHideModal();

  if (!notice) return null;

  const now = new Date();
  const startDate = new Date(notice.startDate);
  const endDate = new Date(notice.endDate);
  
  let status: 'UPCOMING' | 'ACTIVE' | 'EXPIRED' = 'ACTIVE';
  if (now < startDate) status = 'UPCOMING';
  else if (now > endDate) status = 'EXPIRED';

  const scopeColors: Record<string, string> = {
    CLASS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    TEACHERS_ONLY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    SCHOOL_WIDE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  const statusColors = {
    UPCOMING: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950',
    ACTIVE: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950',
    EXPIRED: 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900',
  };
  
  const StatusIcon = {
    UPCOMING: Clock,
    ACTIVE: CheckCircle2,
    EXPIRED: XCircle,
  }[status];

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={notice.title}
      description={
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={cn("border-none text-[10px]", scopeColors[notice.scope])}>
            {notice.scope.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className={cn("border-none flex gap-1 text-[10px]", statusColors[status])}>
            <StatusIcon className="w-3 h-3" />
            {status}
          </Badge>
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 opacity-70" />
            <span>Author: {notice.creator ? `${notice.creator.firstName} ${notice.creator.lastName}` : 'System'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-70" />
            <span>Valid: {format(startDate, 'MMM d, yyyy h:mm a')} &rarr; {format(endDate, 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>

        {notice.scope === 'CLASS' && notice.classes && notice.classes.length > 0 && (
          <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Target Classes</p>
            <div className="flex flex-wrap gap-1.5">
              {notice.classes.map((c) => (
                <span key={c.classId} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs">
                  {c.class.name} ({c.class.program?.code || ''})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="py-2">
          <RichTextContent html={notice.content} />
        </div>
      </div>
    </Modal>
  );
}
