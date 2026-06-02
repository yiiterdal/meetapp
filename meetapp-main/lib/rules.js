function parseKeywordLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function transcriptMatchesAny(transcript, keywords) {
  const t = String(transcript || "").toLowerCase();
  return keywords.some((kw) => t.includes(kw));
}

/** Append rule-based coaching lines (settings.recordingRuleKeywords / restrictionRuleKeywords). */
function enrichAnalysisWithRules(analysis, transcript, settings) {
  const out = { ...analysis };
  const tips = Array.isArray(analysis.coachingTips) ? [...analysis.coachingTips] : [];
  const rec = parseKeywordLines(settings.recordingRuleKeywords ?? "");
  const rst = parseKeywordLines(settings.restrictionRuleKeywords ?? "");

  if (rst.length && transcriptMatchesAny(transcript, rst)) {
    tips.unshift(
      "Restriction rule: transcript hits a keyword from your exclusion list. Review confidentiality before sharing externally."
    );
  }
  if (rec.length && transcriptMatchesAny(transcript, rec)) {
    tips.push(
      `Recording emphasis: transcript matched focus keywords (${rec.slice(0, 5).join(", ")}${
        rec.length > 5 ? " …" : ""
      }). Tie coaching back to those themes.`
    );
  }

  out.coachingTips = tips;
  return out;
}

module.exports = { parseKeywordLines, transcriptMatchesAny, enrichAnalysisWithRules };
