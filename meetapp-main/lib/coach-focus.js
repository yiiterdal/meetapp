/** First line of a turn looks like `Speaker A: …` or `Maria: …` (matches server transcript labelling prompt). */
const SPEAKER_LABEL_LINE_RE =
  /^((?:Speaker\s+(?:[A-Z]|[0-9]{1,2}))|(?:[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}))\s*:\s*(.*)$/u;

const SPEAKER_TURN_RE =
  /^((?:Speaker\s+(?:[A-Z]|[0-9]{1,2}))|(?:[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}))\s*:\s*([\s\S]*)$/u;

function prettySpeakerTurnLabel(headCapture) {
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

function normalizeCoachFocus(str) {
  return String(str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function labelMatchesFocus(labelPretty, rawFocus) {
  const fp = normalizeCoachFocus(rawFocus);
  const lp = normalizeCoachFocus(labelPretty);
  if (!fp) return false;
  if (lp === fp) return true;
  const mF = fp.match(/^speaker (.+)$/);
  const mL = lp.match(/^speaker (.+)$/);
  if (mF && mL && mF[1] === mL[1]) return true;
  return false;
}

/**
 * Turns from line scanning: labels only on dedicated lines (`Speaker X:`),
 * continuation lines folded into previous turn.
 */
function segmentTranscriptIntoSpeakerTurns(fullText) {
  const segments = [];
  const lines = String(fullText ?? "").split(/\r?\n/);

  /** @type {{ headCapture: string, bodyLines: string[] } | null} */
  let cur = null;

  function flush() {
    if (!cur) return;
    const speakerLabel = prettySpeakerTurnLabel(cur.headCapture);
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

/** Fallback: paragraphs split by \\n\\n+ when speaker label only appears at paragraph start */
function legacyParagraphSpeakerTurns(fullText) {
  const blocks = fullText
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  const segments = [];
  for (const block of blocks) {
    const mm = block.match(SPEAKER_TURN_RE);
    if (!mm) continue;
    const speakerLabel = prettySpeakerTurnLabel(mm[1]);
    const body = (mm[2] || "").trim();
    if (!body) continue;
    segments.push({ speakerLabel, body });
  }
  return segments;
}

function transcriptHasSpeakerTurnBlocks(transcriptText) {
  const txt = String(transcriptText ?? "").trim();
  if (!txt) return false;
  if (segmentTranscriptIntoSpeakerTurns(txt).length > 0) return true;
  return legacyParagraphSpeakerTurns(txt).length > 0;
}

function turnsForCoachFocus(fullTranscript) {
  const txt = String(fullTranscript ?? "").trim();
  if (!txt) return [];
  const lineTurns = segmentTranscriptIntoSpeakerTurns(txt);
  if (lineTurns.length > 0) return lineTurns;
  return legacyParagraphSpeakerTurns(txt);
}

/**
 * When coachFocusSpeaker is blank / "all" / "__all__", returns full trimmed text.
 */
function extractCoachTranscriptForFocus(fullTranscript, rawFocus) {
  const full = String(fullTranscript ?? "").trim();

  function isAllModes(f) {
    const s = String(f ?? "").trim();
    return !s || /^(__all__|all)$/i.test(s);
  }

  if (!full) {
    return { text: "", mode: "empty", matchedBlocks: 0 };
  }

  const isAll = isAllModes(rawFocus);
  if (isAll) {
    return { text: full, mode: "all", matchedBlocks: null };
  }

  const turns = turnsForCoachFocus(full);
  const matchedBodies = [];

  for (const turn of turns) {
    if (labelMatchesFocus(turn.speakerLabel, rawFocus) && turn.body) {
      matchedBodies.push(turn.body);
    }
  }

  return {
    text: matchedBodies.join("\n\n"),
    mode: "filtered",
    matchedBlocks: matchedBodies.length,
  };
}

module.exports = {
  prettySpeakerTurnLabel,
  transcriptHasSpeakerTurnBlocks,
  extractCoachTranscriptForFocus,
  segmentTranscriptIntoSpeakerTurns,
};
