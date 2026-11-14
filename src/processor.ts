import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseScheduleText } from "./parser";
import type { FileResult, ScheduleRecord } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type ExtractionResult = {
  records: ScheduleRecord[];
  files: FileResult[];
};

async function extractPdfText(file: Blob): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows: Array<{ y: number; x: number; value: string }> = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = item.transform;
      rows.push({ y: transform[5], x: transform[4], value: item.str });
    }
    rows.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Array<{ y: number; values: string[] }> = [];
    for (const row of rows) {
      const line = lines.find((candidate) => Math.abs(candidate.y - row.y) < 2.5);
      if (line) line.values.push(row.value);
      else lines.push({ y: row.y, values: [row.value] });
    }
    pages.push(lines.map((line) => line.values.join(" ").replace(/\s+/g, " ").trim()).join("\n"));
  }
  return pages.join("\n");
}

async function processPdf(fileName: string, file: Blob): Promise<{
  records: ScheduleRecord[];
  status: FileResult;
}> {
  try {
    const text = await extractPdfText(file);
    if (!text.trim()) {
      return {
        records: [],
        status: {
          fileName,
          status: "error",
          details: "No selectable text was found. This may be a scanned PDF; OCR is not provided.",
          records: 0,
        },
      };
    }
    const parsed = parseScheduleText(text, fileName);
    if (parsed.issue) {
      return {
        records: parsed.records,
        status: {
          fileName,
          status: "error",
          details: parsed.issue,
          records: parsed.records.length,
        },
      };
    }
    if (parsed.skippedReason) {
      return {
        records: [],
        status: {
          fileName,
          status: "skipped",
          details: parsed.skippedReason,
          records: 0,
        },
      };
    }
    return {
      records: parsed.records,
      status: {
        fileName,
        status: "parsed",
        details: "Team robot-game schedule extracted.",
        records: parsed.records.length,
      },
    };
  } catch (error) {
    return {
      records: [],
      status: {
        fileName,
        status: "error",
        details: error instanceof Error ? error.message : "The PDF could not be read.",
        records: 0,
      },
    };
  }
}

export async function extractFiles(files: File[]): Promise<ExtractionResult> {
  const candidates: Array<{ fileName: string; file: Blob }> = [];
  const initialResults: FileResult[] = [];

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      try {
        const archive = await JSZip.loadAsync(file);
        const pdfEntries = Object.values(archive.files).filter(
          (entry) => !entry.dir && /\.pdf$/i.test(entry.name) && !entry.name.startsWith("__MACOSX/"),
        );
        if (!pdfEntries.length) {
          initialResults.push({
            fileName: file.name,
            status: "error",
            details: "The ZIP archive contains no PDF files.",
            records: 0,
          });
        }
        for (const entry of pdfEntries) {
          candidates.push({ fileName: entry.name, file: await entry.async("blob") });
        }
      } catch (error) {
        initialResults.push({
          fileName: file.name,
          status: "error",
          details: error instanceof Error ? error.message : "The ZIP archive could not be opened.",
          records: 0,
        });
      }
    } else if (/\.pdf$/i.test(file.name)) {
      candidates.push({ fileName: file.name, file });
    } else {
      initialResults.push({
        fileName: file.name,
        status: "skipped",
        details: "Only PDF and ZIP files are supported.",
        records: 0,
      });
    }
  }

  const processed = await Promise.all(
    candidates.map(({ fileName, file }) => processPdf(fileName, file)),
  );
  return {
    records: processed.flatMap((result) => result.records),
    files: [...initialResults, ...processed.map((result) => result.status)],
  };
}
