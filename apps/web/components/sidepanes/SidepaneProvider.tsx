'use client';

import { useHideSidePane } from '@/hooks/use-sidepane';
import { useAppSelector } from '@/lib/store';
import { SidePaneType } from '@/lib/store/types/sidepane';

import { DummySidepane } from './DummySidepane';
import { TimetablePeriodSidepane } from './TimetablePeriodSidepane';

// Registry: one line per sidepane. React.ComponentType<any> is intentional —
// each sidepane narrows its own payload type internally (mirrors ModalDialog).
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const SIDEPANE_COMPONENTS: Record<SidePaneType, React.ComponentType<any>> = {
  [SidePaneType.DummySidepane]: DummySidepane,
  [SidePaneType.TimetablePeriodSidepane]: TimetablePeriodSidepane,
};

export function SidepaneProvider() {
  const { isOpen, type, payload } = useAppSelector(
    (state) => state.ui.sidepane,
  );
  const close = useHideSidePane();

  if (!isOpen || !type) return null;

  const SidepaneComponent =
    SIDEPANE_COMPONENTS[type as keyof typeof SIDEPANE_COMPONENTS];
  if (!SidepaneComponent) return null;

  return <SidepaneComponent isOpen={isOpen} onClose={close} {...payload} />;
}
