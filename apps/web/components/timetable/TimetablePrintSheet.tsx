'use client';

import { useMemo } from 'react';

import { ISO_DAY_LABELS, formatTime } from '@/lib/timetable';
import type { TimetableViewResponse } from '@/services/api/requests/timetables';
import { format, parseISO } from 'date-fns';

interface TimetablePrintSheetProps {
  view: TimetableViewResponse;
  /** e.g. student/child/teacher name shown in the sheet header. */
  subjectLabel: string;
  schoolName?: string;
}

/**
 * A4-landscape weekly sheet. Hidden on screen; made visible by the scoped
 * `body.print-timetable` rules in globals.css when use-timetable-print runs.
 * The @page rule ships with the component so it only applies while a page
 * that renders the sheet is being printed.
 */
export function TimetablePrintSheet({
  view,
  subjectLabel,
  schoolName,
}: TimetablePrintSheetProps) {
  const days = useMemo(() => {
    const byDay = new Map(view.days.map((day) => [day.dayOfWeek, day]));
    return view.periodTemplate.workingDays.map(
      (dayOfWeek) =>
        byDay.get(dayOfWeek) ?? { dayOfWeek, date: '', entries: [] },
    );
  }, [view]);

  const templateRows = useMemo(
    () =>
      [...view.periodTemplate.slots].sort((a, b) => a.sortOrder - b.sortOrder),
    [view],
  );

  const firstDate = days[0]?.date;
  const lastDate = days[days.length - 1]?.date;
  const weekLabel =
    firstDate && lastDate
      ? `${format(parseISO(firstDate), 'd MMM')} – ${format(
          parseISO(lastDate),
          'd MMM yyyy',
        )}`
      : '';

  return (
    <div className="timetable-print-root hidden bg-white text-black">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <div className="mb-3 flex items-end justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-bold">{view.timetable.name}</h1>
          <p className="text-xs">{subjectLabel}</p>
        </div>
        <div className="text-right text-xs">
          {schoolName && <p className="font-semibold">{schoolName}</p>}
          {weekLabel && <p>Week of {weekLabel}</p>}
        </div>
      </div>

      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr>
            <th className="border border-black bg-zinc-100 px-1.5 py-1 text-left">
              Period
            </th>
            {days.map((day) => (
              <th
                key={day.dayOfWeek}
                className="border border-black bg-zinc-100 px-1.5 py-1 text-center"
              >
                {ISO_DAY_LABELS[day.dayOfWeek]}
                {day.date && (
                  <span className="block font-normal">
                    {format(parseISO(day.date), 'd MMM')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {templateRows.map((slot) => {
            if (slot.kind !== 'PERIOD') {
              return (
                <tr key={slot.sortOrder}>
                  <td
                    colSpan={days.length + 1}
                    className="border border-black bg-zinc-100 px-1.5 py-0.5 text-center font-semibold uppercase tracking-wider"
                  >
                    {slot.label} · {formatTime(slot.startTime)} –{' '}
                    {formatTime(slot.endTime)}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={slot.sortOrder}>
                <td className="border border-black px-1.5 py-1 align-top">
                  <span className="block font-semibold">{slot.label}</span>
                  <span className="block">
                    {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </span>
                </td>
                {days.map((day) => {
                  const entry =
                    day.entries.find(
                      (candidate) =>
                        candidate.periodNumber === slot.periodNumber,
                    ) ?? null;
                  return (
                    <td
                      key={day.dayOfWeek}
                      className="border border-black px-1.5 py-1 align-top"
                    >
                      {entry ? (
                        <>
                          <span className="block font-semibold">
                            {entry.course.name}
                            {entry.class ? ` (${entry.class.name})` : ''}
                          </span>
                          <span className="block">
                            {entry.substitution
                              ? `${entry.substitution.teacherName} (sub)`
                              : (entry.teacher?.name ?? '')}
                            {entry.room ? ` · ${entry.room.name}` : ''}
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[8px] text-zinc-600">
        Generated by Gurukul
        {view.timetable.publishedAt
          ? ` · published ${format(
              parseISO(view.timetable.publishedAt),
              'd MMM yyyy',
            )}`
          : ''}
      </p>
    </div>
  );
}
