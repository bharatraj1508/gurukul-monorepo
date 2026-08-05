import { useCallback } from 'react';

import { useAppDispatch } from '@/lib/store';
import { hideSidePane, showSidePane } from '@/lib/store/slices/uiSlice';
import { SidePanePayloadMap, SidePaneType } from '@/lib/store/types/sidepane';

export function useShowSidePane() {
  const dispatch = useAppDispatch();
  return useCallback(
    <T extends SidePaneType>(type: T, payload?: SidePanePayloadMap[T]) => {
      dispatch(showSidePane({ type, payload }));
    },
    [dispatch],
  );
}

export function useHideSidePane() {
  const dispatch = useAppDispatch();
  return useCallback(() => {
    dispatch(hideSidePane());
  }, [dispatch]);
}

// Convenience hooks for specific sidepanes
export function useDummySidepane() {
  const show = useShowSidePane();
  return useCallback(
    (payload?: SidePanePayloadMap[SidePaneType.DummySidepane]) => {
      show(SidePaneType.DummySidepane, payload);
    },
    [show],
  );
}

export function useShowTimetablePeriodSidepane() {
  const show = useShowSidePane();
  return useCallback(
    (payload: SidePanePayloadMap[SidePaneType.TimetablePeriodSidepane]) => {
      show(SidePaneType.TimetablePeriodSidepane, payload);
    },
    [show],
  );
}

// Keep a backward compatible useSidepane wrapper for any legacy uses
export function useSidepane() {
  const show = useShowSidePane();
  const hide = useHideSidePane();

  const open = useCallback(
    (type: string, data?: any) => {
      show(type as SidePaneType, data);
    },
    [show],
  );

  return {
    open,
    close: hide,
  };
}
