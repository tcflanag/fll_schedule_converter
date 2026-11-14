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

9:30 AM 9:37 AM Robot Game - Table 2
10:15 AM 10:45 AM Judging Session - Panel A
10:15 AM 10:22 AM Robot Game - Table 1
12:00 PM 12:07 PM Robot Game - Table 1
1:45 PM 1:52 PM Robot Game - Table 2`;

describe("parseScheduleText", () => {
  it("assigns match labels in the order listed, regardless of table or start time", () => {
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
      ["Practice Match", "9:30 AM", "9:37 AM", "Table 2"],
      ["Official Match 1", "10:15 AM", "10:22 AM", "Table 1"],
      ["Official Match 2", "12:00 PM", "12:07 PM", "Table 1"],
      ["Official Match 3", "1:45 PM", "1:52 PM", "Table 2"],
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

  it("labels available games in listed order when the schedule is incomplete", () => {
    const result = parseScheduleText(
      teamSchedule.replace("1:45 PM 1:52 PM Robot Game - Table 2", ""),
      "incomplete.pdf",
    );
    expect(result.records.map((record) => record.type)).toEqual([
      "Practice Match",
      "Official Match 1",
      "Official Match 2",
    ]);
    expect(result.issue).toBeUndefined();
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

  it("sorts CSV rows by time without changing the preview order or event names", () => {
    const records: ScheduleRecord[] = [
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
    ];

    const customRows = buildCsv(records, "My Custom Event").split("\r\n");
    expect(customRows[1].startsWith('"My Custom Event",')).toBe(true);
    expect(customRows[2].startsWith('"My Custom Event",')).toBe(true);

    const defaultRows = buildCsv(records).split("\r\n");
    expect(defaultRows[1].startsWith('"Source Event A",')).toBe(true);
    expect(defaultRows[2].startsWith('"Source Event B",')).toBe(true);
    expect(records.map((record) => record.eventName)).toEqual(["Source Event B", "Source Event A"]);
  });
});
