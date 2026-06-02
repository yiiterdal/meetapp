"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseKeywordLines, enrichAnalysisWithRules } = require("../lib/rules");

test("parseKeywordLines splits lines and commas", () => {
  assert.deepEqual(parseKeywordLines("foo, bar\nbaz"), ["foo", "bar", "baz"]);
});

test("enrichAnalysisWithRules adds restriction tip", () => {
  const a = enrichAnalysisWithRules(
    { coachingTips: ["a"] },
    "We discussed pricing and NDA templates",
    { restrictionRuleKeywords: "nda\nsecret", recordingRuleKeywords: "" }
  );
  assert.ok(a.coachingTips[0].includes("Restriction"));
});

test("enrichAnalysisWithRules adds recording emphasis", () => {
  const a = enrichAnalysisWithRules(
    { coachingTips: [] },
    "Great update on revenue goals",
    { restrictionRuleKeywords: "", recordingRuleKeywords: "revenue" }
  );
  assert.ok(a.coachingTips.some((x) => String(x).includes("Recording emphasis")));
});
