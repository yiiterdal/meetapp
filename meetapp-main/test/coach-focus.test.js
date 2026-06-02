const test = require("node:test");
const assert = require("node:assert/strict");
const {
  transcriptHasSpeakerTurnBlocks,
  extractCoachTranscriptForFocus,
} = require("../lib/coach-focus");

test("detects labelled speaker blocks", () => {
  assert.equal(transcriptHasSpeakerTurnBlocks("Hello only"), false);
  assert.equal(transcriptHasSpeakerTurnBlocks("Speaker A: Hi\n\nSpeaker B: Hey"), true);
});

test("extract single speaker bodies", () => {
  const t = "Speaker A: One line.\n\nSpeaker B: Other.\n\nSpeaker A: Second.";
  const r = extractCoachTranscriptForFocus(t, "Speaker A");
  assert.equal(r.mode, "filtered");
  assert.equal(r.matchedBlocks, 2);
  assert.ok(r.text.includes("One line"));
  assert.ok(r.text.includes("Second"));
  assert.ok(!r.text.includes("Other"));
});

test("all mode returns full transcript", () => {
  const t = "Speaker A: X\n\nSpeaker B: Y";
  const r = extractCoachTranscriptForFocus(t, "");
  assert.equal(r.mode, "all");
  assert.equal(r.text, t);
});

test("single newline between speakers extracts correct turns", () => {
  const t = "Speaker A: First.\nSpeaker B: Second.\nSpeaker A: Third.";
  assert.equal(transcriptHasSpeakerTurnBlocks(t), true);
  const rb = extractCoachTranscriptForFocus(t, "Speaker B");
  assert.equal(rb.mode, "filtered");
  assert.equal(rb.matchedBlocks, 1);
  assert.ok(rb.text.includes("Second"));
  assert.ok(!rb.text.includes("First"));
});
