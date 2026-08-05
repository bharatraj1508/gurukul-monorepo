'use client';

import { useCallback, useEffect } from 'react';

const PRINT_BODY_CLASS = 'print-timetable';

/**
 * Print the timetable via the scoped @media print block in globals.css:
 * toggles a body class so the print stylesheet stays inert everywhere else,
 * opens the native print dialog, and cleans the class up afterwards.
 */
export function useTimetablePrint() {
  useEffect(() => {
    const cleanup = () => document.body.classList.remove(PRINT_BODY_CLASS);
    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  return useCallback(() => {
    document.body.classList.add(PRINT_BODY_CLASS);
    // Give the browser a beat to apply the class before opening the dialog.
    window.setTimeout(() => window.print(), 50);
  }, []);
}
