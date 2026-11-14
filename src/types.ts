export const CSV_HEADERS = [
  "Event Name",
  "Type",
  "Date (mm/dd/yyyy)",
  "Start Time",
  "End Time",
  "Room / Table Location",
  "Team Number",
  "Team Name",
] as const;

export type ScheduleRecord = {
  eventName: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  teamNumber: string;
  teamName: string;
  sourceFile: string;
};

export type FileResult = {
  fileName: string;
  status: "parsed" | "skipped" | "error";
  details: string;
  records: number;
};

export type EventMetadata = {
  eventName: string;
  date: string;
};
