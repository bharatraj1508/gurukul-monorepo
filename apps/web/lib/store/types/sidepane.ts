export enum SidePaneType {
  DummySidepane = 'DummySidepane',
  TimetablePeriodSidepane = 'TimetablePeriodSidepane',
}

export interface DummySidepanePayload {
  message?: string;
}

export interface TimetablePeriodSidepanePayload {
  /** e.g. "Period 3". */
  periodLabel: string;
  /** e.g. "Tuesday, 12 Aug". */
  dayLabel: string;
  /** "HH:mm" 24h times. */
  startTime: string;
  endTime: string;
  courseName: string;
  teacherName?: string | null;
  roomName?: string | null;
  substitution?: { teacherName: string; reason: string | null } | null;
}

export type SidePanePayloadMap = {
  [SidePaneType.DummySidepane]: DummySidepanePayload;
  [SidePaneType.TimetablePeriodSidepane]: TimetablePeriodSidepanePayload;
};

export type SidePanePayload =
  | DummySidepanePayload
  | TimetablePeriodSidepanePayload;
