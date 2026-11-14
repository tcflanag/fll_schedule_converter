import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import { parseScheduleText } from "./parser";
import { CSV_HEADERS, type ScheduleRecord } from "./types";

const teamSchedule = `FIRST LEGO League Qualifying Tournament
Hillsboro
12/6/2024

Team 33916 LatinoXmetaforce

Family/Community
Plaza Comunitaria Encuentro
Hillsboro

Start End Activity

9:30 AM 9:37 AM Robot Game - Table 1
10:15 AM 10:45 AM Judging Session - Panel A
12:00 PM 12:07 PM Robot Game - Table 2
1:45 PM 1:52 PM Robot Game - Table 1
2:52 PM 3:00 PM Robot Game - Table 2`;

describe("parseScheduleText", () => {
  it("extracts event metadata and assigns the observed two-table match labels", () => {
    const result = parseScheduleText(teamSchedule, "team.pdf");
    expect(result.metadata).toEqual({
      eventName: "FIRST LEGO League Qualifying Tournament - Hillsboro",
      date: "12/06/2024",
    });
    expect(result.records).toHaveLength(4);
    expect(result.records.map(({ type, startTime, endTime, location }) => [
      type,
      startTime,
      endTime,
      location,
    ])).toEqual([
      ["Practice Match", "9:30 AM", "9:37 AM", "Table 1"],
      ["Official Match 1", "1:45 PM", "1:52 PM", "Table 1"],
      ["Official Match 2", "12:00 PM", "12:07 PM", "Table 2"],
      ["Official Match 3", "2:52 PM", "3:00 PM", "Table 2"],
    ]);
  });

  it("preserves wrapped team names", () => {
    const result = parseScheduleText(
      teamSchedule.replace(
        "Team 33916 LatinoXmetaforce\n\nFamily/Community",
        "Team 67133 Kraxberger Gearheads Lego Robotics\nChallenge Team\n\nFamily/Community",
      ),
      "team.pdf",
    );
    expect(result.records[0].teamName).toBe("Kraxberger Gearheads Lego Robotics Challenge Team");
  });

  it("does not mistake the school or sponsor line for part of the team name", () => {
    const result = parseScheduleText(
      teamSchedule.replace(
        "Team 33916 LatinoXmetaforce\n\nFamily/Community\nPlaza Comunitaria Encuentro",
        "Team 74515 Sunshine Circuits\nSunshine Elite Education\nBeaverton\n\nStart",
      ),
      "team.pdf",
    );
    expect(result.records[0].teamName).toBe("Sunshine Circuits");
  });

  it("surfaces schedule PDFs that have no extractable text or robot-game rows", () => {
    expect(parseScheduleText(" \n ", "scan.pdf").records).toHaveLength(0);
    const noTeam = parseScheduleText("FIRST LEGO League Qualifying Tournament\nHillsboro", "event.pdf");
    expect(noTeam.skippedReason).toMatch(/No per-team/);
  });

  it("does not invent match types for schedules with an unexpected table layout", () => {
    const result = parseScheduleText(
      teamSchedule.replace("2:52 PM 3:00 PM Robot Game - Table 2", ""),
      "incomplete.pdf",
    );
    expect(result.records.some((record) => record.type === "Robot Game")).toBe(true);
    expect(result.issue).toMatch(/could not be inferred/i);
  });

  it("exports the exact requested headers and quotes commas and embedded quotes", () => {
    const record: ScheduleRecord = {
      eventName: 'FLL, "Regional"',
      type: "Practice Match",
      date: "12/06/2024",
      startTime: "9:30 AM",
      endTime: "9:37 AM",
      location: "Table 1",
      teamNumber: "33916",
      teamName: "Team, One",
      sourceFile: "source.pdf",
    };
    const csv = buildCsv([record]).split("\r\n");
    expect(csv[0]).toBe(CSV_HEADERS.map((header) => `"${header}"`).join(","));
    expect(csv[1]).toBe('"FLL, ""Regional""","Practice Match","12/06/2024","9:30 AM","9:37 AM","Table 1","33916","Team, One"');
  });

  it("uses a supplied event name for every row, while preserving source names by default", () => {
    const records: ScheduleRecord[] = [
      {
        eventName: "Source Event A",
        type: "Practice Match",
        date: "12/06/2024",
        startTime: "9:30 AM",
        endTime: "9:37 AM",
        location: "Table 1",
        teamNumber: "33916",
        teamName: "Team One",
        sourceFile: "one.pdf",
      },
      {
        eventName: "Source Event B",
        type: "Official Match 1",
        date: "12/06/2024",
        startTime: "1:45 PM",
        endTime: "1:52 PM",
        location: "Table 1",
        teamNumber: "40886",
        teamName: "Team Two",
        sourceFile: "two.pdf",
      },
    ];

    const customRows = buildCsv(records, "My Custom Event").split("\r\n");
    expect(customRows[1].startsWith('"My Custom Event",')).toBe(true);
    expect(customRows[2].startsWith('"My Custom Event",')).toBe(true);

    const defaultRows = buildCsv(records).split("\r\n");
    expect(defaultRows[1].startsWith('"Source Event A",')).toBe(true);
    expect(defaultRows[2].startsWith('"Source Event B",')).toBe(true);
  });
});
