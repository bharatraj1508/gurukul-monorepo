'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ViewerChild } from '@/services/api/requests/timetables';
import { Check, ChevronDown, GraduationCap } from 'lucide-react';

interface ChildSwitcherProps {
  childProfiles: ViewerChild[];
  selectedId: string | null;
  onSelect: (studentProfileId: string) => void;
}

/** Segmented buttons up to three children, dropdown beyond. */
export function ChildSwitcher({
  childProfiles,
  selectedId,
  onSelect,
}: ChildSwitcherProps) {
  if (childProfiles.length <= 1) return null;

  if (childProfiles.length <= 3) {
    return (
      <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/40 p-1">
        {childProfiles.map((child) => (
          <button
            key={child.studentProfileId}
            type="button"
            onClick={() => onSelect(child.studentProfileId)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              selectedId === child.studentProfileId
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {child.name}
            {child.className && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {child.className}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  const selected = childProfiles.find(
    (child) => child.studentProfileId === selectedId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GraduationCap className="h-4 w-4" />
          {selected?.name ?? 'Select child'}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {childProfiles.map((child) => (
          <DropdownMenuItem
            key={child.studentProfileId}
            onClick={() => onSelect(child.studentProfileId)}
          >
            <span className="flex-1 truncate">
              {child.name}
              {child.className && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {child.className}
                </span>
              )}
            </span>
            {selectedId === child.studentProfileId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
