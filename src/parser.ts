import type { EventMetadata, ScheduleRecord } from "./types";

type ParsedText = {
  metadata: EventMetadata;
  records: ScheduleRecord[];
  issue?: string;
  skippedReason?: string;
};

const TIME_PATTERN = String.raw`(\d{1,2}:\d{2}\s*[AP]M)`;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim());
}

function formatDate(rawDate: string | undefined): string {
  if (!rawDate) return "";
  const match = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}`;
}

function getMetadata(text: string): EventMetadata {
  const lines = normalizeLines(text).filter(Boolean);
  const titleIndex = lines.findIndex((line) =>
    /FIRST LEGO League Qualifying Tournament/i.test(line),
  );
  const title = titleIndex >= 0 ? lines[titleIndex] : "FLL Event";
  const venue = titleIndex >= 0 ? lines[titleIndex + 1] ?? "" : "";
  const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
  return {
    eventName: venue && !/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/.test(venue)
      ? `${title} - ${venue}`
      : title,
    date: formatDate(dateMatch?.[1]),
  };
}

function timeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = Number(match[1]) % 12;
  return hour * 60 + Number(match[2]) + (match[3].toUpperCase() === "PM" ? 720 : 0);
}

function classifyGames(
  games: Array<{ startTime: string; endTime: string; location: string }>,
): Array<{ type: string; startTime: string; endTime: string; location: string }> {
  const tableOne = games
    .filter((game) => game.location === "Table 1")
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const tableTwo = games
    .filter((game) => game.location === "Table 2")
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  if (tableOne.length === 2 && tableTwo.length === 2 && games.length === 4) {
    return [
      { ...tableOne[0], type: "Practice Match" },
      { ...tableOne[1], type: "Official Match 1" },
      { ...tableTwo[0], type: "Official Match 2" },
      { ...tableTwo[1], type: "Official Match 3" },
    ];
  }

  return games.map((game) => ({ ...game, type: "Robot Game" }));
}

export function parseScheduleText(text: string, sourceFile: string): ParsedText {
  const metadata = getMetadata(text);
  const lines = normalizeLines(text);
  const teamLineIndex = lines.findIndex((line) => /^Team\s+\d+\s+\S/i.test(line));
  if (teamLineIndex < 0) {
    return {
      metadata,
      records: [],
      skippedReason: "No per-team robot schedule was found in this PDF.",
    };
  }

  const teamMatch = lines[teamLineIndex].match(/\bTeam\s+(\d+)\s*(.*)$/i);
  if (!teamMatch) {
    return { metadata, records: [], issue: "A team heading was present but could not be read." };
  }
  const teamNumber = teamMatch[1];
  let teamName = teamMatch[2].trim();
  const continuation = lines[teamLineIndex + 1] ?? "";
  if (/\bTeam$/i.test(continuation)) {
    teamName = `${teamName} ${continuation}`.trim();
  }

  const gamePattern = new RegExp(
    `^${TIME_PATTERN}\\s+${TIME_PATTERN}\\s+Robot Game\\s*[-–]\\s*Table\\s+(\\d+)\\s*$`,
    "i",
  );
  const games: Array<{ startTime: string; endTime: string; location: string }> = [];
  for (const line of lines) {
    const match = line.match(gamePattern);
    if (!match) continue;
    games.push({
      startTime: match[1].replace(/\s+/g, " ").toUpperCase(),
      endTime: match[2].replace(/\s+/g, " ").toUpperCase(),
      location: `Table ${match[3]}`,
    });
  }

  if (!games.length) {
    return {
      metadata,
      records: [],
      issue: `Team ${teamNumber} was identified, but no selectable Robot Game - Table entries were found.`,
    };
  }

  const classified = classifyGames(games);
  const records = classified.map((game) => ({
    eventName: metadata.eventName,
    type: game.type,
    date: metadata.date,
    startTime: game.startTime,
    endTime: game.endTime,
    location: game.location,
    teamNumber,
    teamName,
    sourceFile,
  }));
  return {
    metadata,
    records,
    ...(classified.some((game) => game.type === "Robot Game")
      ? { issue: "Match labels could not be inferred; games are labeled Robot Game for review." }
      : {}),
  };
}
