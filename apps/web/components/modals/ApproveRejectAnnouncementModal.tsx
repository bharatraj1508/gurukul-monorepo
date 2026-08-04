'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Announcement,
  useApproveAnnouncement,
  useRejectAnnouncement,
} from '@/services/api/requests/announcements';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { Calendar, User, Check, X } from 'lucide-react';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';

interface ApproveRejectAnnouncementModalProps {
  announcement?: Announcement | null;
}

export function ApproveRejectAnnouncementModal({
  announcement = null,
}: ApproveRejectAnnouncementModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const { mutateAsync: approveAnnouncement, isPending: isApproving } = useApproveAnnouncement();
  const { mutateAsync: rejectAnnouncement, isPending: isRejectingApi } = useRejectAnnouncement();

  if (!announcement) return null;

  const startDate = new Date(announcement.startDate);
  const endDate = new Date(announcement.endDate);

  const handleApprove = async () => {
    try {
      await approveAnnouncement(announcement.id);
      toast.success('Announcement approved and published!');
      hideModal();
    } catch (error) {
      showError(error);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      setReasonError('Please provide a reason for rejecting this announcement.');
      return;
    }
    try {
      await rejectAnnouncement({
        id: announcement.id,
        dto: { rejectionReason: rejectionReason.trim() },
      });
      toast.success('Announcement rejected.');
      hideModal();
    } catch (error) {
      showError(error);
    }
  };

  const isPending = isApproving || isRejectingApi;

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title="Review Announcement Proposal"
      description={`Submitted by ${announcement.creator ? `${announcement.creator.firstName} ${announcement.creator.lastName}` : 'Staff member'}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">{announcement.title}</h3>
          
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{announcement.creator?.email}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Active: {format(startDate, 'MMM d, yyyy')} &rarr; {format(endDate, 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg min-h-[120px]">
          <RichTextContent html={announcement.content} />
        </div>

        {isRejecting && (
          <Field className="pt-2 animate-in fade-in duration-200">
            <FieldLabel className="text-red-600 dark:text-red-400">Feedback / Rejection Reason *</FieldLabel>
            <textarea
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (e.target.value.trim()) setReasonError('');
              }}
              placeholder="Explain why this announcement is rejected or needs changes..."
              className="flex min-h-[90px] w-full rounded-md border border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            />
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="outline" onClick={hideModal} disabled={isPending}>
            Close
          </Button>

          {!isRejecting ? (
            <>
              <Button
                variant="destructive"
                onClick={() => setIsRejecting(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <X className="w-4 h-4" /> Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="w-4 h-4" /> Approve & Publish
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsRejecting(false)} disabled={isPending}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectSubmit}
                disabled={isPending}
              >
                {isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
