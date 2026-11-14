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

export function buildCsv(records: ScheduleRecord[], eventName?: string): string {
  return [
    CSV_HEADERS.map(csvCell).join(","),
    ...records.map((record) =>
      COLUMNS.map((column) =>
        csvCell(column === "eventName" ? eventName ?? record.eventName : record[column]),
      ).join(","),
    ),
  ].join("\r\n");
}
