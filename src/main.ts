import { extractFiles } from "./processor";
import { buildCsv } from "./csv";
import { CSV_HEADERS, type FileResult, type ScheduleRecord } from "./types";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root element is missing.");

let records: ScheduleRecord[] = [];
let fileResults: FileResult[] = [];
let customEventName = "";
let busy = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function render(): void {
  const errorCount = fileResults.filter((file) => file.status === "error").length;
  const skippedCount = fileResults.filter((file) => file.status === "skipped").length;
  const teamCount = new Set(records.map((record) => record.teamNumber)).size;
  app!.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="ORTOP to FIRST(R) Event Hub schedule converter home">
          <span class="brand-mark">O</span><span>ORTOP <b>→</b> FIRST(R) Event Hub</span>
        </a>
        <span class="local-badge"><i></i> Runs locally in your browser</span>
      </header>
      <section class="intro">
        <div class="eyebrow"><span class="eyebrow-rule"></span> SCHEDULE TOOLKIT</div>
        <h1>ORTOP schedules,<br><em>ready for FIRST(R) Event Hub.</em></h1>
        <p>Convert the ORTOP team schedules shared with competitors into a CSV referees can import into FIRST(R) Event Hub to find teams quickly.</p>
      </section>
      <section class="upload-card ${busy ? "is-busy" : ""}" id="drop-zone">
        <div class="upload-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg></div>
        <div class="upload-copy">
          <h2>${busy ? "Reading schedules…" : "Drop files to get started"}</h2>
          <p>Upload a ZIP archive or select multiple PDFs</p>
          <label class="choose-button" for="file-input">${busy ? "Processing…" : "Choose files"}</label>
          <input id="file-input" type="file" accept=".pdf,.zip,application/pdf,application/zip" multiple ${busy ? "disabled" : ""}>
        </div>
        <span class="file-hint">PDF · ZIP</span>
      </section>
      <div class="privacy-note"><span class="lock">⌑</span> Files stay on this device. Nothing is uploaded to a server.</div>
      ${fileResults.length ? renderResults(errorCount, skippedCount, teamCount) : renderGuide()}
      <footer><span>ORTOP to FIRST(R) Event Hub</span><span>Private by design <b>·</b> CSV export</span></footer>
    </main>`;

  document.querySelector<HTMLInputElement>("#file-input")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) void processFiles(Array.from(input.files));
  });
  const dropZone = document.querySelector<HTMLElement>("#drop-zone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
  dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
    const dropped = Array.from((event as DragEvent).dataTransfer?.files ?? []);
    if (dropped.length) void processFiles(dropped);
  });
  document.querySelector<HTMLButtonElement>("#export-button")?.addEventListener("click", exportCsv);
  document.querySelector<HTMLInputElement>("#event-name-input")?.addEventListener("input", (event) => {
    customEventName = (event.currentTarget as HTMLInputElement).value;
    const displayedEventName = customEventName.trim();
    document.querySelectorAll<HTMLElement>(".event-name-cell").forEach((cell, index) => {
      cell.textContent = displayedEventName || records[index].eventName;
    });
  });
}

function renderGuide(): string {
  return `
    <section class="guide">
      <div class="guide-heading"><span class="section-label">HOW IT WORKS</span><span class="guide-line"></span></div>
      <div class="steps">
        <article class="step"><span class="step-number">01</span><div><h3>Add schedules</h3><p>Choose a ZIP containing PDFs, or select individual PDF files together.</p></div></article>
        <article class="step"><span class="step-number">02</span><div><h3>Check the results</h3><p>Review extracted team games and see which files need attention.</p></div></article>
        <article class="step"><span class="step-number">03</span><div><h3>Import into Event Hub</h3><p>Download the CSV and import it into FIRST(R) Event Hub so referees can find teams quickly.</p></div></article>
      </div>
      <div class="format-note"><span class="format-icon">↳</span><span>Robot-game records only <i>·</i> PDF text extraction <i>·</i> Exact CSV column order</span></div>
    </section>`;
}

function renderResults(errors: number, skipped: number, teams: number): string {
  const fileRows = fileResults
    .map(
      (file) => `<div class="file-row">
        <span class="file-type ${file.status}">${file.status === "parsed" ? "✓" : file.status === "error" ? "!" : "–"}</span>
        <span class="file-name">${escapeHtml(file.fileName)}</span>
        <span class="file-detail">${escapeHtml(file.details)}</span>
        <span class="file-count">${file.records ? `${file.records} rows` : ""}</span>
      </div>`,
    )
    .join("");
  const tableRows = records
    .map(
      (record) => `<tr>
        <td class="event-name-cell">${escapeHtml(customEventName.trim() || record.eventName)}</td><td><span class="type-pill">${escapeHtml(record.type)}</span></td>
        <td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.startTime)}</td><td>${escapeHtml(record.endTime)}</td>
        <td>${escapeHtml(record.location)}</td><td class="team-number">${escapeHtml(record.teamNumber)}</td><td>${escapeHtml(record.teamName)}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="results">
      <div class="results-head"><div><span class="section-label">EXTRACTION RESULTS</span><h2>Review your schedules</h2></div>
        <button id="export-button" class="export-button" ${records.length ? "" : "disabled"}><span>↓</span> Export CSV</button></div>
      <div class="stats">
        <div class="stat"><strong>${records.length}</strong><span>schedule rows</span></div>
        <div class="stat"><strong>${teams}</strong><span>teams found</span></div>
        <div class="stat ${errors ? "has-warning" : ""}"><strong>${errors}</strong><span>files need review</span></div>
        <div class="stat"><strong>${skipped}</strong><span>non-team PDFs skipped</span></div>
      </div>
      <div class="event-name-control">
        <label for="event-name-input">Event name for CSV</label>
        <input id="event-name-input" type="text" value="${escapeHtml(customEventName)}" placeholder="Enter an event name">
        <span>Applied to every exported row</span>
      </div>
      <div class="table-wrap"><table><thead><tr>${CSV_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${tableRows || `<tr><td class="empty-state" colspan="8">No schedule records could be extracted.</td></tr>`}</tbody></table></div>
      <p class="match-note">Matches are labeled in the order listed in each team's schedule: Practice, Official 1, Official 2, and Official 3.</p>
      <div class="file-report"><div class="file-report-heading"><h3>Files processed</h3><span>${fileResults.length} total</span></div>${fileRows}</div>
    </section>`;
}

async function processFiles(files: File[]): Promise<void> {
  busy = true;
  render();
  try {
    const result = await extractFiles(files);
    records = result.records;
    fileResults = result.files;
    customEventName = records[0]?.eventName ?? "";
  } catch (error) {
    records = [];
    customEventName = "";
    fileResults = [{
      fileName: "Upload",
      status: "error",
      details: error instanceof Error ? error.message : "Files could not be processed.",
      records: 0,
    }];
  } finally {
    busy = false;
    render();
  }
}

function exportCsv(): void {
  if (!records.length) return;
  const content = buildCsv(records, customEventName.trim() || records[0].eventName);
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "fll-schedule.csv";
  link.click();
  URL.revokeObjectURL(url);
}

render();
