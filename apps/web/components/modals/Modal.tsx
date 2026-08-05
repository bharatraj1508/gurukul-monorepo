'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-[500px]',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export interface ActionConfig {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
  size?: ModalSize;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col max-h-[90vh] gap-0 overflow-hidden rounded-xl bg-card border shadow-xl p-6',
          SIZE_CLASSES[size],
          className,
        )}
      >
        {(title || description) && (
          <DialogHeader className="space-y-1.5 pb-4 border-b shrink-0">
            {title && (
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription
                className="text-sm text-muted-foreground"
                asChild={typeof description !== 'string'}
              >
                {typeof description === 'string' ? (
                  description
                ) : (
                  <div>{description}</div>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        <div className="py-4 text-sm leading-relaxed overflow-y-auto flex-1 max-h-[calc(90vh-10rem)] pr-1">
          {children}
        </div>
        {(footer || primaryAction || secondaryAction) && (
          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0 shrink-0">
            {footer ? (
              footer
            ) : (
              <div className="flex w-full items-center justify-end gap-2">
                {secondaryAction && (
                  <Button
                    variant={secondaryAction.variant || 'outline'}
                    onClick={secondaryAction.onClick}
                    disabled={secondaryAction.disabled}
                    type="button"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant || 'default'}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || primaryAction.loading}
                    type="button"
                  >
                    {primaryAction.loading ? 'Saving...' : primaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
