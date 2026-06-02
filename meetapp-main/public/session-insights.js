/**
 * Upload session left rail: smart search, AI filter chips, sentiment heuristics,
 * speaker talktime from labelled turns, topic trackers (localStorage).
 */
(function () {
  const FILTER_PRED = {
    questions: (t) =>
      /\?/.test(t) ||
      /\b(what|who|when|where|why|how|which|could we|can we|should we|isn't|are you|do you|did you|will you|would you|neden|ne zaman|kim|nasıl|hangi)\b/.test(
        t
      ),
    datetime: (t) =>
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|next week|next month|q[1-4]|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/.test(
        t
      ) ||
      /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(t) ||
      /\b\d{1,2}:\d{2}\b/.test(t),
    metrics: (t) =>
      /[\d,.]+%|\$\s*[\d,.]+|€\s*[\d,.]+|£\s*[\d,.]+|\b\d+(\.\d+)?\s*(k|m|b|bn)\b|% growth|y\/y|yoy|percentage|\d+\s*points/.test(t) ||
      /\b\d+[,.]\d+\b.*\b(percent|rate|ratio)\b/.test(t),
    tasks: (t) =>
      /\b(will send|follow up|action item|todo|need to|we should|i will|i'll|assigned|deadline|by next|ship|deliver|let's schedule|sync on|yapacağız|yapalım|göndereceğim|yapılacak)\b/.test(
        t
      ),
    pricing: (t) =>
      /\b(price|pricing|cost|budget|invoice|discount|renewal|per seat|per user|license fee)\b|\$|€|£|\b(usd|eur|try|gbp)\b|\b\d+\s*(usd|try|tl|eur)\b/.test(
        t
      ),
  };

  /** @type {{ lines: { text: string, speaker: string, body: string }[], durationSec: number, meetingKey: string } | null} */
  let sessionInsightState = null;
  let activeAiFilter = null;
  let activeTopicFilter = null;
  let prevMeetingKey = "";

  /** @type { ((e: KeyboardEvent) => void) | null } */
  let topicModalEscBound = null;

  function finishTopicTrackerModal(submitValue) {
    const backdrop = document.getElementById("topicTrackerModal");
    const err = document.getElementById("topicTrackerModalErr");
    const input = document.getElementById("topicTrackerModalInput");

    if (submitValue != null && String(submitValue).trim()) {
      const k = String(submitValue).trim().slice(0, 60);
      const cur = loadTopics();
      if (cur.includes(k)) {
        if (err) {
          err.textContent = "That keyword is already tracked.";
          err.classList.remove("hidden");
        }
        return;
      }
      cur.push(k);
      saveTopics(cur);
      renderTopicChips(loadTopics());
    }

    if (topicModalEscBound) {
      document.removeEventListener("keydown", topicModalEscBound);
      topicModalEscBound = null;
    }
    if (backdrop) backdrop.classList.add("hidden");
    err?.classList.add("hidden");
    if (input) input.value = "";
  }

  function ensureTopicTrackerModal() {
    if (document.getElementById("topicTrackerModal")) return;
    const backdrop = document.createElement("div");
    backdrop.id = "topicTrackerModal";
    backdrop.className = "app-modal-backdrop hidden";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "topicTrackerModalTitle");
    backdrop.innerHTML = `
      <div class="app-modal-card--dialog" id="topicTrackerModalCard">
        <h2 id="topicTrackerModalTitle" class="app-modal-title">Track a topic</h2>
        <p class="app-modal-body">Highlight every transcript line that contains this keyword.</p>
        <p class="app-modal-hint muted" style="font-size:12px;margin-bottom:14px">Examples: roadmap, pricing, Q4</p>
        <label class="app-modal-field" for="topicTrackerModalInput">
          <span class="app-modal-label">Keyword</span>
          <input type="text" id="topicTrackerModalInput" class="app-modal-input" maxlength="60" autocomplete="off" />
        </label>
        <p id="topicTrackerModalErr" class="app-modal-hint hidden" style="color:#b91c1c;margin-bottom:12px"></p>
        <div class="app-modal-actions">
          <button type="button" class="app-modal-btn app-modal-btn--secondary" id="topicTrackerModalCancel">Cancel</button>
          <button type="button" class="app-modal-btn app-modal-btn--primary" id="topicTrackerModalOk">Add</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finishTopicTrackerModal(null);
    });

    document.getElementById("topicTrackerModalCancel")?.addEventListener("click", () => finishTopicTrackerModal(null));

    document.getElementById("topicTrackerModalOk")?.addEventListener("click", () => {
      const input = document.getElementById("topicTrackerModalInput");
      const err = document.getElementById("topicTrackerModalErr");
      const v = String(input?.value || "").trim();
      if (!v) {
        if (err) {
          err.textContent = "Enter a keyword to track.";
          err.classList.remove("hidden");
        }
        return;
      }
      finishTopicTrackerModal(v);
    });

    document.getElementById("topicTrackerModalInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("topicTrackerModalOk")?.click();
      }
    });
  }

  function openTopicTrackerModal() {
    const existing = document.getElementById("topicTrackerModal");
    if (existing && !existing.classList.contains("hidden")) {
      finishTopicTrackerModal(null);
    }
    ensureTopicTrackerModal();
    const backdrop = document.getElementById("topicTrackerModal");
    const input = document.getElementById("topicTrackerModalInput");
    const err = document.getElementById("topicTrackerModalErr");
    err?.classList.add("hidden");
    if (input) input.value = "";
    backdrop?.classList.remove("hidden");
    topicModalEscBound = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finishTopicTrackerModal(null);
      }
    };
    document.addEventListener("keydown", topicModalEscBound);
    setTimeout(() => input?.focus(), 0);
  }

  function countLineHits(lines, id) {
    const pred = FILTER_PRED[id];
    if (!pred) return 0;
    return lines.filter((L) => pred(L.text)).length;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function speakerInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toLocaleUpperCase("tr");
    const a = [...parts[0]][0] || "?";
    const b = [...parts[parts.length - 1]][0] || "?";
    return `${a}${b}`.toLocaleUpperCase("tr");
  }

  function speakerHue(name) {
    let h = 0;
    const s = String(name || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 200 + (h % 120);
  }

  function countWords(s) {
    return String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function computeSentiment(lines) {
    const POS =
      /\b(great|good|excellent|thanks|thank you|perfect|love|awesome|excited|happy|win|wins|success|glad|agree|nice|wonderful|mükemmel|harika|teşekkür)\b/i;
    const NEG =
      /\b(bad|sorry|problem|issue|risk|concern|delay|failed|unfortunately|worried|blocked|angry|pain|stuck|never|impossible|maalesef|sorun)\b/i;
    let pos = 0;
    let neg = 0;
    let neu = 0;
    for (const L of lines) {
      const t = L.text;
      const pc = (t.match(POS) || []).length;
      const nc = (t.match(NEG) || []).length;
      if (!pc && !nc) neu++;
      else if (pc >= nc) pos++;
      else neg++;
    }
    const tot = pos + neg + neu || 1;
    const p = Math.round((pos / tot) * 100);
    const n = Math.round((neg / tot) * 100);
    let nu = 100 - p - n;
    if (nu < 0) nu = 0;
    if (!lines.length) return { positive: 38, negative: 10, neutral: 52 };
    return { positive: p, negative: n, neutral: nu };
  }

  function computeSpeakers(lines, durationSec) {
    const by = new Map();
    for (const L of lines) {
      const sp = L.speaker || "Speaker";
      by.set(sp, (by.get(sp) || 0) + countWords(L.body));
    }
    const totalW = [...by.values()].reduce((a, b) => a + b, 0) || 1;
    const totalMin = Math.max(durationSec / 60, 1 / 60);
    return [...by.entries()]
      .map(([label, words]) => {
        const talkPct = Math.round((words / totalW) * 100);
        const shareMin = (talkPct / 100) * totalMin;
        const wpm = Math.round(words / Math.max(shareMin, 0.05));
        return { label, initials: speakerInitials(label), words, wpm, talkPct, hue: speakerHue(label) };
      })
      .sort((a, b) => b.talkPct - a.talkPct);
  }

  function topicsStorageKey() {
    const k = sessionInsightState?.meetingKey || "default";
    return `meetinglyTopicTrackers:${k}`;
  }

  function loadTopics() {
    try {
      const raw = localStorage.getItem(topicsStorageKey());
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveTopics(arr) {
    localStorage.setItem(topicsStorageKey(), JSON.stringify(arr));
  }

  function applyTranscriptLineFilter() {
    const rows = document.querySelectorAll("#transcriptLines .transcript-line");
    const smart = (document.getElementById("uploadViewSmartSearch")?.value || "").trim().toLowerCase();
    const classic = (document.getElementById("transcriptSearch")?.value || "").trim().toLowerCase();
    const searchQ = smart || classic;

    rows.forEach((row, i) => {
      const lineText = sessionInsightState
        ? sessionInsightState.lines[i]?.text || row.innerText.toLowerCase()
        : row.innerText.toLowerCase();
      let ok = true;
      if (searchQ && !lineText.includes(searchQ)) ok = false;
      if (sessionInsightState && activeTopicFilter) {
        if (!lineText.includes(activeTopicFilter.toLowerCase())) ok = false;
      }
      if (sessionInsightState && activeAiFilter && FILTER_PRED[activeAiFilter]) {
        if (!FILTER_PRED[activeAiFilter](lineText)) ok = false;
      }
      row.classList.toggle("hidden", !ok);
    });
  }

  function wireSmartSearchOnce() {
    const sm = document.getElementById("uploadViewSmartSearch");
    if (!sm || sm.dataset.insightsWired === "1") return;
    sm.dataset.insightsWired = "1";
    sm.addEventListener("input", applyTranscriptLineFilter);
  }

  function renderAiFilters(lines) {
    const grid = document.getElementById("uploadInsightsAiFiltersGrid");
    if (!grid) return;
    const defs = [
      { id: "questions", label: "Questions", color: "#6366f1" },
      { id: "datetime", label: "Date & time", color: "#0ea5e9" },
      { id: "metrics", label: "Metrics", color: "#ca8a04" },
      { id: "tasks", label: "Tasks", color: "#16a34a" },
      { id: "pricing", label: "Pricing", color: "#ea580c" },
    ];
    grid.innerHTML = defs
      .map((d) => {
        const n = countLineHits(lines, d.id);
        const on = activeAiFilter === d.id ? " ai-filter-chip--on" : "";
        return `<button type="button" class="ai-filter-chip${on}" data-ai-filter="${d.id}" aria-pressed="${activeAiFilter === d.id}">
      <span class="ai-filter-dot" style="background:${d.color}"></span>
      <span class="ai-filter-label">${escapeHtml(d.label)}</span>
      <span class="ai-filter-count">${n}</span>
    </button>`;
      })
      .join("");
  }

  function renderSentiment(sent) {
    const el = document.getElementById("uploadInsightsSentimentRows");
    if (!el) return;
    const rows = [
      { label: "Neutral", pct: sent.neutral, dot: "#94a3b8", bar: "#94a3b8" },
      { label: "Negative", pct: sent.negative, dot: "#ef4444", bar: "#ef4444" },
      { label: "Positive", pct: sent.positive, dot: "#22c55e", bar: "#22c55e" },
    ];
    el.innerHTML = rows
      .map(
        (r) => `
    <div class="sentiment-row">
      <span class="sentiment-dot" style="background:${r.dot}"></span>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
          <span style="color:#334155;font-weight:600">${escapeHtml(r.label)}</span>
        </div>
        <div class="sentiment-bar-wrap"><div class="sentiment-bar" style="width:${r.pct}%;background:${r.bar}"></div></div>
      </div>
      <span class="sentiment-pct">${r.pct}%</span>
    </div>`
      )
      .join("");
  }

  function renderSpeakers(spk) {
    const el = document.getElementById("uploadInsightsSpeakerRows");
    if (!el) return;
    if (!spk.length) {
      el.innerHTML = `<p class="muted" style="margin:0;font-size:12px">Add speaker labels like <strong>Name:</strong> in the transcript to see talktime splits.</p>`;
      return;
    }
    el.innerHTML = spk
      .map((s) => {
        const ring = `hsl(${s.hue} 52% 46%)`;
        return `<div class="speaker-insight-row">
  <div class="speaker-insight-avatar" style="background:${ring}">${escapeHtml(s.initials)}</div>
  <div class="speaker-insight-main">
    <div class="speaker-insight-name">${escapeHtml(s.label)}</div>
    <div class="speaker-insight-meta">${s.words} words · ~${s.wpm} WPM</div>
  </div>
  <div class="speaker-insight-ring-wrap">
    <div class="speaker-insight-ring" style="--ring-pct:${s.talkPct};--ring-color:${ring}">
      <div class="speaker-insight-ring-inner">${s.talkPct}%</div>
    </div>
  </div>
</div>`;
      })
      .join("");
  }

  function renderTopicChips(topics) {
    const el = document.getElementById("uploadInsightsTopicChips");
    if (!el) return;
    if (!topics.length) {
      el.innerHTML = `<p class="muted" style="margin:0;font-size:11px">Track keywords to filter lines (saved in this browser).</p>`;
      return;
    }
    el.innerHTML = topics
      .map((tpc) => {
        const enc = encodeURIComponent(tpc);
        const on = activeTopicFilter === tpc ? " topic-tracker-chip--on" : "";
        return `<span class="topic-tracker-chip${on}" role="group">
      <button type="button" class="topic-tracker-chip-label" data-topic-filter="${enc}">${escapeHtml(tpc)}</button>
      <button type="button" class="topic-tracker-chip-remove" data-topic-remove="${enc}" aria-label="Remove ${escapeHtml(tpc)}">×</button>
    </span>`;
      })
      .join("");
  }

  function insightsDelegation(ev) {
    const addBtn = ev.target.closest("#uploadInsightsTopicAddBtn");
    if (addBtn) {
      openTopicTrackerModal();
      return;
    }

    const rm = ev.target.closest("[data-topic-remove]");
    if (rm) {
      let key = "";
      try {
        key = decodeURIComponent(rm.getAttribute("data-topic-remove") || "");
      } catch {
        return;
      }
      const next = loadTopics().filter((x) => x !== key);
      saveTopics(next);
      if (activeTopicFilter === key) activeTopicFilter = null;
      renderTopicChips(loadTopics());
      renderAiFilters(sessionInsightState?.lines || []);
      applyTranscriptLineFilter();
      return;
    }

    const chip = ev.target.closest(".ai-filter-chip[data-ai-filter]");
    if (chip) {
      const id = chip.getAttribute("data-ai-filter") || "";
      activeAiFilter = activeAiFilter === id ? null : id;
      if (activeAiFilter) activeTopicFilter = null;
      renderAiFilters(sessionInsightState?.lines || []);
      applyTranscriptLineFilter();
      return;
    }

    const tbtn = ev.target.closest("[data-topic-filter]");
    if (tbtn && !ev.target.closest("[data-topic-remove]")) {
      let key = "";
      try {
        key = decodeURIComponent(tbtn.getAttribute("data-topic-filter") || "");
      } catch {
        return;
      }
      activeTopicFilter = activeTopicFilter === key ? null : key;
      if (activeTopicFilter) activeAiFilter = null;
      renderAiFilters(sessionInsightState?.lines || []);
      renderTopicChips(loadTopics());
      applyTranscriptLineFilter();
    }
  }

  function wireDelegationOnce() {
    const root = document.getElementById("uploadReviewInsights");
    if (!root || root.dataset.delegateWired === "1") return;
    root.dataset.delegateWired = "1";
    root.addEventListener("click", insightsDelegation);
  }

  /** @param {{ lines: { text: string, speaker: string, body: string }[], durationSec?: number, meetingKey?: string }} opts */
  window.renderUploadSessionInsights = function (opts) {
    wireDelegationOnce();
    wireSmartSearchOnce();
    const lines = Array.isArray(opts.lines) ? opts.lines : [];
    const durationSec = Number.isFinite(opts.durationSec) ? opts.durationSec : 0;
    const meetingKey = String(opts.meetingKey || "");

    if (prevMeetingKey !== meetingKey) {
      activeAiFilter = null;
      activeTopicFilter = null;
      const ss = document.getElementById("uploadViewSmartSearch");
      if (ss) ss.value = "";
      prevMeetingKey = meetingKey;
    }

    sessionInsightState = { lines, durationSec, meetingKey };

    const sent = computeSentiment(lines);
    renderSentiment(sent);
    renderSpeakers(computeSpeakers(lines, durationSec));
    if (activeAiFilter && !FILTER_PRED[activeAiFilter]) activeAiFilter = null;
    renderAiFilters(lines);
    renderTopicChips(loadTopics());
    applyTranscriptLineFilter();
  };

  window.applyUploadViewTranscriptLineFilter = applyTranscriptLineFilter;
})();
