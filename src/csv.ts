import { CSV_HEADERS, type ScheduleRecord } from "./types";

const COLUMNS: Array<keyof ScheduleRecord> = [
  "eventName",
  "type",
  "date",
  "startTime",
  "endTime",
  "location",
  "teamNumber",
  "teamName",
];

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function timeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = Number(match[1]) % 12;
  return hour * 60 + Number(match[2]) + (match[3].toUpperCase() === "PM" ? 720 : 0);
}

export function buildCsv(records: ScheduleRecord[], eventName?: string): string {
  const sortedRecords = [...records].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );
  return [
    CSV_HEADERS.map(csvCell).join(","),
    ...sortedRecords.map((record) =>
      COLUMNS.map((column) =>
        csvCell(column === "eventName" ? eventName ?? record.eventName : record[column]),
      ).join(","),
    ),
  ].join("\r\n");
}
