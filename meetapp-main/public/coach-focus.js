/** Shared speaker-turn parsing — keep segmentation rules aligned with lib/coach-focus.js (server). */

const SPEAKER_LABEL_LINE_RE =
  /^((?:Speaker\s+(?:[A-Z]|[0-9]{1,2}))|(?:[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}))\s*:\s*(.*)$/u;

const SPEAKER_TURN_RE =
  /^((?:Speaker\s+(?:[A-Z]|[0-9]{1,2}))|(?:[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}))\s*:\s*([\s\S]*)$/u;

function prettyCoachSpeakerTurnLabel(headCapture) {
  let label = `${headCapture}`.replace(/\s+/g, " ").trim();
  if (/^speaker\s+[A-Za-z0-9]/i.test(label)) {
    label = label.replace(/^speaker/i, "Speaker");
    const sub = label.match(/^Speaker\s+(.+)$/i);
    const idRaw = sub ? String(sub[1]).trim() : "";
    if (/^[a-z]$/.test(idRaw)) return `Speaker ${idRaw.toUpperCase()}`;
    if (/^[A-Z]$/i.test(idRaw)) return `Speaker ${idRaw.toUpperCase()}`;
    if (/^\d+$/.test(idRaw)) return `Speaker ${idRaw}`;
    return label;
  }
  return label.replace(/\s+/g, " ").trim();
}

function segmentTranscriptIntoSpeakerTurns(fullText) {
  const segments = [];
  const lines = String(fullText ?? "").split(/\r?\n/);
  /** @type {{ headCapture: string, bodyLines: string[] } | null} */
  let cur = null;

  function flush() {
    if (!cur) return;
    const speakerLabel = prettyCoachSpeakerTurnLabel(cur.headCapture);
    const body = cur.bodyLines.join("\n").trim();
    if (body) segments.push({ speakerLabel, body });
    cur = null;
  }

  for (const rawLine of lines) {
    const trim = rawLine.trim();
    const m = trim.match(SPEAKER_LABEL_LINE_RE);
    if (m) {
      flush();
      cur = {
        headCapture: m[1].replace(/\s+/g, " ").trim(),
        bodyLines: m[2] != null && String(m[2]).length ? [m[2]] : [],
      };
    } else if (cur) {
      cur.bodyLines.push(rawLine);
    }
  }
  flush();
  return segments;
}

function legacyParagraphSpeakerTurns(fullText) {
  const blocks = String(fullText ?? "")
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  const segments = [];
  for (const block of blocks) {
    const mm = block.match(SPEAKER_TURN_RE);
    if (!mm) continue;
    const speakerLabel = prettyCoachSpeakerTurnLabel(mm[1]);
    const body = (mm[2] || "").trim();
    if (!body) continue;
    segments.push({ speakerLabel, body });
  }
  return segments;
}

/** Ordered unique speaker labels in first-seen order. */
function collectTranscriptSpeakerLabels(rawText) {
  const txt = String(rawText ?? "").trim();
  if (!txt) return [];
  let turns = segmentTranscriptIntoSpeakerTurns(txt);
  if (!turns.length) turns = legacyParagraphSpeakerTurns(txt);

  const ordered = [];
  const seen = new Set();
  for (const t of turns) {
    const key = t.speakerLabel.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(t.speakerLabel);
    }
  }
  return ordered;
}

/**
 * Exact label match for host/capture hint (case-insensitive, normalized spaces).
 * Returns null when no labelled turn matches.
 */
function coachFocusFromHostHint(transcriptText, hostHint) {
  const labels = collectTranscriptSpeakerLabels(transcriptText);
  const h = String(hostHint ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!h || !labels.length) return null;
  for (const l of labels) {
    if (l.toLowerCase().replace(/\s+/g, " ") === h) return l;
  }
  return null;
}

function normalizeCoachFocusForSave(v) {
  if (!v || String(v).trim() === "" || String(v).trim().toLowerCase() === "__all__") return "";
  return String(v).trim();
}
