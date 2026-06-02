function getSessionAuthHeaders() {
  try {
    const j = JSON.parse(sessionStorage.getItem("meetinglyDemoAuth") || "null");
    if (j && j.token) return { Authorization: `Bearer ${j.token}` };
  } catch {
    /* ignore */
  }
  return {};
}

async function fetchJson(url, options = {}) {
  const optHeaders = options.headers ? { ...options.headers } : {};
  const mergedHeaders = {
    ...getSessionAuthHeaders(),
    ...optHeaders,
  };
  if (options.body && typeof options.body === "string" && !mergedHeaders["Content-Type"]) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers: mergedHeaders });
  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Request failed (${res.status}).`);
    throw new Error("Invalid response.");
  }
  if (!res.ok) {
    const detail = data.details ? ` ${data.details}` : "";
    throw new Error(`${data.error || "Request failed"}${detail}`);
  }
  return data;
}

let appModalsMounted = false;
let appConfirmResolver = null;
let appPromptResolver = null;

function mountAppModals() {
  if (appModalsMounted) return;
  appModalsMounted = true;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="appConfirmBackdrop" class="app-modal-backdrop hidden" aria-hidden="true">
      <div class="app-modal-card app-modal-card--dialog" role="alertdialog" aria-modal="true" aria-labelledby="appConfirmTitle" aria-describedby="appConfirmMessage">
        <h3 id="appConfirmTitle" class="app-modal-title"></h3>
        <p id="appConfirmMessage" class="app-modal-body"></p>
        <div class="app-modal-actions">
          <button type="button" class="app-modal-btn app-modal-btn--secondary" id="appConfirmCancel"></button>
          <button type="button" class="app-modal-btn" id="appConfirmOk"></button>
        </div>
      </div>
    </div>
    <div id="appPromptBackdrop" class="app-modal-backdrop hidden" aria-hidden="true">
      <div class="app-modal-card app-modal-card--dialog" role="dialog" aria-modal="true" aria-labelledby="appPromptTitle">
        <h3 id="appPromptTitle" class="app-modal-title"></h3>
        <p id="appPromptHint" class="app-modal-body app-modal-hint hidden"></p>
        <label class="app-modal-field">
          <span id="appPromptLabel" class="app-modal-label"></span>
          <input type="text" id="appPromptInput" class="app-modal-input" autocomplete="off" />
        </label>
        <div class="app-modal-actions">
          <button type="button" class="app-modal-btn app-modal-btn--secondary" id="appPromptCancel"></button>
          <button type="button" class="app-modal-btn app-modal-btn--primary" id="appPromptOk"></button>
        </div>
      </div>
    </div>`
  );

  const cbd = document.getElementById("appConfirmBackdrop");
  document.getElementById("appConfirmCancel").addEventListener("click", () => closeAppConfirm(false));
  document.getElementById("appConfirmOk").addEventListener("click", () => closeAppConfirm(true));
  cbd.addEventListener("click", (e) => {
    if (e.target === cbd) closeAppConfirm(false);
  });

  const pbd = document.getElementById("appPromptBackdrop");
  const pInput = document.getElementById("appPromptInput");
  document.getElementById("appPromptCancel").addEventListener("click", () => closeAppPrompt(null));
  document.getElementById("appPromptOk").addEventListener("click", () => closeAppPrompt(pInput.value));
  pbd.addEventListener("click", (e) => {
    if (e.target === pbd) closeAppPrompt(null);
  });
  pInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      closeAppPrompt(pInput.value);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const cOpen = cbd && !cbd.classList.contains("hidden");
    const pOpen = pbd && !pbd.classList.contains("hidden");
    if (cOpen) {
      e.preventDefault();
      closeAppConfirm(false);
    } else if (pOpen) {
      e.preventDefault();
      closeAppPrompt(null);
    }
  });
}

function closeAppConfirm(result) {
  const cbd = document.getElementById("appConfirmBackdrop");
  if (!cbd || cbd.classList.contains("hidden")) return;
  cbd.classList.add("hidden");
  cbd.setAttribute("aria-hidden", "true");
  const fn = appConfirmResolver;
  appConfirmResolver = null;
  if (fn) fn(Boolean(result));
}

function showAppConfirm(opts = {}) {
  mountAppModals();
  return new Promise((resolve) => {
    appConfirmResolver = resolve;
    document.getElementById("appConfirmTitle").textContent = opts.title || "Confirm";
    document.getElementById("appConfirmMessage").textContent = opts.message || "";
    document.getElementById("appConfirmCancel").textContent = opts.cancelLabel || "Cancel";
    const okBtn = document.getElementById("appConfirmOk");
    okBtn.textContent = opts.confirmLabel || "OK";
    okBtn.className = `app-modal-btn ${opts.danger ? "app-modal-btn--danger" : "app-modal-btn--primary"}`;

    const cbd = document.getElementById("appConfirmBackdrop");
    cbd.classList.remove("hidden");
    cbd.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => okBtn.focus());
  });
}

function closeAppPrompt(result) {
  const pbd = document.getElementById("appPromptBackdrop");
  if (!pbd || pbd.classList.contains("hidden")) return;
  pbd.classList.add("hidden");
  pbd.setAttribute("aria-hidden", "true");
  const fn = appPromptResolver;
  appPromptResolver = null;
  if (fn) fn(result);
}

function showAppPrompt(opts = {}) {
  mountAppModals();
  return new Promise((resolve) => {
    appPromptResolver = resolve;
    document.getElementById("appPromptTitle").textContent = opts.title || "Edit";
    const hint = document.getElementById("appPromptHint");
    if (opts.message) {
      hint.textContent = opts.message;
      hint.classList.remove("hidden");
    } else {
      hint.textContent = "";
      hint.classList.add("hidden");
    }
    document.getElementById("appPromptLabel").textContent = opts.label || "Name";
    const input = document.getElementById("appPromptInput");
    input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
    document.getElementById("appPromptOk").textContent = opts.confirmLabel || "Save";
    document.getElementById("appPromptCancel").textContent = opts.cancelLabel || "Cancel";

    const pbd = document.getElementById("appPromptBackdrop");
    pbd.classList.remove("hidden");
    pbd.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

function badgeClass(status) {
  const normalized = (status || "").toLowerCase();
  if (["ready", "completed", "transcribed", "active"].includes(normalized)) return "ok";
  if (["processing", "pending", "uploading", "invited"].includes(normalized)) return "wait";
  return "info";
}

function prettyStatus(status) {
  return String(status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMegabytes(bytes) {
  return (Math.max(0, bytes || 0) / (1024 * 1024)).toFixed(1);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Removes zero‑width/format characters so checklist rows are not bare checkboxes after .trim(). */
function normalizeVisibleCoachCopy(text) {
  return String(text ?? "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function settingsEnabledToBool(v) {
  return v === true || String(v).toLowerCase() === "enabled";
}

function settingsBoolToEnabled(checked) {
  return checked ? "Enabled" : "Disabled";
}

/** Mirrors server `normalizeTranscriptTokenForAlign` so coach phrases line up stored Whisper timings. */
function normalizeCoachTokenForAlign(token) {
  return String(token ?? "")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .normalize("NFC")
    .replace(/^[\p{Zs}"'`“”‘’]+|[\p{Zs}"'`“”‘’.,!?;:…]+$/gu, "")
    .toLowerCase();
}

/**
 * Best-effort `[start,end]` seconds for a contiguous phrase inside `rawTranscript`,
 * using the same flat per-token start array as interactive transcript (`transcriptTokenStartsSec`).
 */
function coachPhraseTimesFromAlignedTokens(phrase, rawTranscript, flatStarts) {
  const raw = String(rawTranscript ?? "").replace(/\r\n/g, "\n").trim();
  const phraseWords = normalizeVisibleCoachCopy(phrase)
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeCoachTokenForAlign)
    .filter(Boolean);
  if (!phraseWords.length || !raw) return null;

  const rawToks = raw.match(/\S+/gu) ?? [];
  if (
    !Array.isArray(flatStarts) ||
    flatStarts.length !== rawToks.length ||
    !flatStarts.length
  ) {
    return null;
  }

  const rawNorm = rawToks.map(normalizeCoachTokenForAlign);
  const n = phraseWords.length;

  for (let i = 0; i <= rawNorm.length - n; i++) {
    let matched = true;
    for (let j = 0; j < n; j++) {
      if (rawNorm[i + j] !== phraseWords[j]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    const endIdx = i + n - 1;
    const startTs0 = Number(flatStarts[i]);
    if (!Number.isFinite(startTs0)) return null;

    let endTs0;
    if (endIdx + 1 < flatStarts.length) {
      endTs0 = Number(flatStarts[endIdx + 1]);
    } else {
      endTs0 = startTs0 + Math.min(12, Math.max(0.95, n * 0.42 + 0.35));
    }
    if (!Number.isFinite(endTs0)) endTs0 = startTs0 + 1;

    let startTs = Math.max(0, startTs0 - 0.045);
    let endTs = Math.max(startTs + 0.22, endTs0 + 0.06);

    try {
      const media = uploadViewPlaybackMedia;
      const dur = media && Number.isFinite(media.duration) ? Number(media.duration) : 0;
      if (dur > 0) {
        endTs = Math.min(endTs, dur);
        startTs = Math.min(startTs, Math.max(0, endTs - 0.2));
      }
    } catch {
      /* ignore */
    }

    if (endTs - startTs < 0.22) return null;
    return { startTs, endTs };
  }

  return null;
}

async function ensureSpeechSynthReady() {
  if (!("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.resume();
    if (speechSynthesis.getVoices()?.length) return true;
    await new Promise((resolve) => {
      const done = () => {
        speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve(true);
      };
      const onVoices = () => done();
      speechSynthesis.addEventListener("voiceschanged", onVoices);
      setTimeout(done, 400);
    });
    return true;
  } catch {
    return false;
  }
}

/** Pick a BCP‑47 tag for Web Speech (Translate-style read-aloud is browser TTS, not the recording). */
function guessCoachTtsLang(text) {
  const s = String(text ?? "");
  if (/[ğĞüÜşŞıİöÖçÇ]/.test(s)) return "tr-TR";
  if (/[ñÑáéíóúüÁÉÍÓÚÜ¿¡]/.test(s)) return "es-ES";
  if (/[äöüßÄÖÜ]/.test(s)) return "de-DE";
  if (/[àâçéèêëîïôùûüÿœæ]/.test(s)) return "fr-FR";
  return "en-US";
}

/**
 * Speak coach feedback text using the browser voice (no server / no OpenAI TTS).
 * @param {"spoken"|"suggested"} variant - "suggested" is slightly slower for clarity.
 */
async function speakCoachPhrase(text, variant = "suggested") {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !("speechSynthesis" in window)) return Promise.resolve(false);

  await ensureSpeechSynthReady();
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();

  const utter = new SpeechSynthesisUtterance(trimmed);
  utter.lang = guessCoachTtsLang(trimmed);
  utter.pitch = 1;
  if (variant === "spoken") {
    utter.rate = 0.94;
  } else {
    utter.rate = 0.8;
  }

  return new Promise((resolve) => {
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        resolve(false);
      }
    }, 0);
  });
}

function buildCoachAnalysisHTML(analysis) {
  if (!analysis || typeof analysis !== "object") return "";
  const esc = escapeHtml;
  let html = `<div class="coach-block"><h3 class="subsection-title">Summary</h3><p class="coach-summary-text">${esc(
    analysis.summary || ""
  )}</p></div>`;

  const gf = analysis.grammarFixes || [];
  if (gf.length) {
    html += `<h3 class="subsection-title">Grammar fixes</h3><ul class="coach-list">`;
    gf.forEach((item) => {
      html += `<li class="grammar-item"><span class="grammar-original">${esc(item.original)}</span> → <span class="grammar-improved">${esc(
        item.improved
      )}</span><br/><span class="grammar-reason">${esc(item.reason)}</span></li>`;
    });
    html += `</ul>`;
  }

  const pi = analysis.pronunciationIssues || [];
  const pf = analysis.pronunciationFeedback || [];
  if (pi.length || pf.length) {
    html += `<h3 class="subsection-title">Pronunciation</h3>`;
    html += `<p class="muted coach-tts-hint">Red (original) plays from the saved meeting recording when possible. Green (suggested) uses your browser’s read‑aloud voice.</p><ul class="coach-list">`;
    pi.forEach((item) => {
      html += `<li class="pronunciation-item"><div class="pronunciation-comparison-row">`;
      html += `<button type="button" class="coach-tts-btn coach-tts-chip coach-tts-chip--spoken" data-tts-variant="spoken" data-tts="${encodeURIComponent(
        item.spoken || "",
      )}" aria-label="Play original: ${esc(String(item.spoken || ""))}" title="Play original wording">${esc(String(item.spoken || ""))}</button>`;
      html += `<span class="pronunciation-comparison-arrow" aria-hidden="true">→</span>`;
      html += `<button type="button" class="coach-tts-btn coach-tts-chip coach-tts-chip--suggested" data-tts-variant="suggested" data-tts="${encodeURIComponent(
        item.correct || "",
      )}" aria-label="Play suggested: ${esc(String(item.correct || ""))}" title="Play suggested wording">${esc(String(item.correct || ""))}</button>`;
      html += `</div>`;
      html += `<div class="grammar-reason">${esc(item.tip || "")}</div></li>`;
    });
    pf.forEach((item) => {
      html += `<li>${esc(typeof item === "string" ? item : "")}</li>`;
    });
    html += `</ul>`;
  }

  const tips = (analysis.coachingTips || [])
    .map((t) => normalizeVisibleCoachCopy(t))
    .filter(Boolean);
  if (tips.length) {
    html += `<h3 class="subsection-title">Coaching tips</h3><ul class="coach-list tips-list">`;
    tips.forEach((t) => {
      html += `<li>${esc(String(t))}</li>`;
    });
    html += `</ul>`;
  }

  return html;
}

function buildSkillsPanelHTML(analysis) {
  if (!analysis || typeof analysis !== "object") return "";
  const esc = escapeHtml;
  const tips = (analysis.coachingTips || []).map((t) => normalizeVisibleCoachCopy(t)).filter(Boolean);
  const gf = (analysis.grammarFixes || []).filter((item) => {
    const o = normalizeVisibleCoachCopy(item?.original ?? "");
    const im = normalizeVisibleCoachCopy(item?.improved ?? "");
    return Boolean(o || im);
  });
  const pi = (analysis.pronunciationIssues || []).filter((item) => {
    const sp = normalizeVisibleCoachCopy(item?.spoken ?? "");
    const cr = normalizeVisibleCoachCopy(item?.correct ?? "");
    return Boolean(sp || cr);
  });
  const pf = (analysis.pronunciationFeedback || []).filter((x) => {
    return typeof x === "string" && normalizeVisibleCoachCopy(x);
  });

  let html = `<div class="skills-panel-intro"><p class="muted small">Check off habits while rehearsing — same signals as the full coach block on the left.</p></div>`;

  const hasSummary = Boolean(analysis.summary && String(analysis.summary).trim());

  const hasBullets =
    tips.length ||
    gf.length ||
    pi.length ||
    pf.length;

  if (hasSummary) {
    html += `<div class="skills-summary-card"><h4 class="skills-section-title skills-section-title--tight">Summary</h4><p>${esc(
      analysis.summary || ""
    )}</p></div>`;
  }

  if (!hasBullets && !hasSummary) {
    html += `<p class="muted skills-empty-hint">No structured checklist in this analysis. Try Regenerate from transcript.</p>`;
    return html;
  }

  if (tips.length) {
    html += `<h4 class="skills-section-title">Coaching habits</h4><ul class="skills-check-list">`;
    tips.forEach((t) => {
      html += `<li><label><input type="checkbox" /> <span class="skills-check-text">${esc(String(t))}</span></label></li>`;
    });
    html += `</ul>`;
  }

  if (gf.length) {
    html += `<h4 class="skills-section-title">Language precision</h4><ul class="skills-check-list">`;
    gf.forEach((item) => {
      const o = normalizeVisibleCoachCopy(item.original);
      const im = normalizeVisibleCoachCopy(item.improved);
      const line = [o, im].filter(Boolean).join(" → ");
      if (!line) return;
      html += `<li><label><input type="checkbox" /> <span class="skills-check-text">${esc(line)}</span></label></li>`;
    });
    html += `</ul>`;
  }

  if (pi.length) {
    html += `<h4 class="skills-section-title">Pronunciation targets</h4><ul class="skills-check-list">`;
    pi.forEach((item) => {
      const sp = normalizeVisibleCoachCopy(item.spoken);
      const cr = normalizeVisibleCoachCopy(item.correct);
      const line = [sp, cr].filter(Boolean).join(" → ");
      if (!line) return;
      html += `<li><label><input type="checkbox" /> <span class="skills-check-text">${esc(line)}</span></label></li>`;
    });
    html += `</ul>`;
  }

  if (pf.length) {
    html += `<h4 class="skills-section-title">Delivery notes</h4><ul class="skills-check-list">`;
    pf.forEach((t) => {
      const vis = normalizeVisibleCoachCopy(String(t));
      if (!vis) return;
      html += `<li><label><input type="checkbox" /> <span class="skills-check-text">${esc(vis)}</span></label></li>`;
    });
    html += `</ul>`;
  }

  return html;
}

let uploadViewCoachListenWired = false;

function wireUploadViewCoachListen() {
  if (uploadViewCoachListenWired) return;
  const mount = document.getElementById("uploadViewCoachMount");
  if (!mount) return;
  uploadViewCoachListenWired = true;
  mount.addEventListener("click", async (e) => {
    const btn = e.target.closest(".coach-tts-btn[data-tts]");
    if (!btn) return;

    const rawAttr = btn.getAttribute("data-tts") || "";
    let text = "";
    try {
      text = decodeURIComponent(rawAttr);
    } catch {
      try {
        text = decodeURIComponent(decodeURIComponent(rawAttr));
      } catch {
        text = rawAttr;
      }
    }

    const trimmed = String(text).trim();
    if (!trimmed) return;

    const variantRaw = btn.getAttribute("data-tts-variant");
    const variant = variantRaw === "spoken" ? "spoken" : "suggested";

    if (variant !== "spoken" && !("speechSynthesis" in window)) {
      const eb = document.getElementById("pageError");
      if (eb) {
        eb.textContent = "This browser does not support read-aloud (Web Speech API).";
        setTimeout(() => {
          eb.textContent = "";
        }, 5200);
      }
      return;
    }

    let labelPlaying =
      variant === "spoken" ? "Playing from recording…" : "Playing suggestion…";

    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.dataset.origLabel ||= btn.innerHTML;
    const isChip = btn.classList.contains("coach-tts-chip");
    btn.innerHTML = isChip
      ? `<span class="coach-tts-chip-glyph" aria-hidden="true">▶</span>${escapeHtml(labelPlaying)}`
      : `<span class="coach-tts-glyph" aria-hidden="true">…</span> ${escapeHtml(labelPlaying)}`;

    try {
      if (variant === "spoken") {
        const media = uploadViewPlaybackMedia;
        let mediaDur =
          media && Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
        const hasAlignedTimings =
          Array.isArray(uploadViewFlatTokenStartsSnapshot) && uploadViewFlatTokenStartsSnapshot.length > 0;
        const whisperEst = coachPhraseTimesFromAlignedTokens(
          trimmed,
          uploadViewRawTranscriptSnapshot,
          uploadViewFlatTokenStartsSnapshot,
        );
        /** Do not interpolate when word-level timings exist — wrong seeks look like “playback does nothing”. */
        let est =
          whisperEst ||
          (!hasAlignedTimings
            ? estimateCoachSpokenSnippet(
                trimmed,
                uploadViewTranscriptPartsSnapshot,
                uploadViewTimelineSecSnapshot,
                mediaDur,
              )
            : null);
        let ok = false;
        if (media && est) ok = await playCoachRecordingWindow(media, est.startTs, est.endTs);
        else ok = false;
        if (!ok) {
          const ttsOk = await speakCoachPhrase(trimmed, "spoken");
          const eb = document.getElementById("pageError");
          if (eb) {
            if (!ttsOk) {
              eb.textContent =
                "Could not play this phrase from the recording or with read‑aloud. Try Chrome/Edge and check system volume.";
            } else {
              eb.textContent = media
                ? "Played read‑aloud (recording seek was unclear). Use transcript word taps for an exact jump."
                : "Played read‑aloud — no recording file is stored for this session.";
            }
            setTimeout(() => {
              eb.textContent = "";
            }, 6400);
          }
        }
      } else {
        await speakCoachPhrase(trimmed, variant);
      }
    } finally {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.innerHTML = btn.dataset.origLabel || btn.innerHTML;
    }
  });
}

function meetingMenuSVGShare() {
  return `<svg class="meeting-menu-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>`;
}

function meetingMenuSVGCopy() {
  return `<svg class="meeting-menu-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
}

function meetingMenuSVGDownload() {
  return `<svg class="meeting-menu-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
}

function meetingMenuSVGMove() {
  return `<svg class="meeting-menu-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m14 18-4 4 4 4 1.25-1.25-2-2H21v-1.75H13.25l2-2L14 18z"/></svg>`;
}

function meetingMenuSVGText() {
  return `<svg class="meeting-menu-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg>`;
}

function meetingMenuSVGTrash() {
  return `<svg class="meeting-menu-ico meeting-menu-ico-danger" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
}

function parseDurationLabelToSeconds(label) {
  const parts = String(label ?? "")
    .trim()
    .split(":")
    .map((x) => Number.parseInt(x, 10));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Player time label: short mm:ss, or hh:mm:ss when needed */
function formatTransportClock(seconds) {
  const t = Number(seconds);
  if (!Number.isFinite(t) || t < 0) return "00:00";
  if (t >= 3600) return formatDuration(t);
  return formatMmSs(t);
}

const UPLOAD_PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/** Latest video/audio in upload-review (for transcript word seeks). */
let uploadViewPlaybackMedia = null;

/** Same segmentation as the interactive transcript — used to map spoken phrases onto the timeline. */
let uploadViewTranscriptPartsSnapshot = [];

let uploadViewTimelineSecSnapshot = 0;

/** Parsed duration from stored metadata (may be floored mm:ss); real file length can differ slightly. */
let uploadViewDurationLabelSec = 0;

/** Per-turn body token start times (sec) when Whisper alignment is present; parallel to `uploadViewTranscriptPartsSnapshot`. */
let uploadViewBodyStartsSlicesSnapshot = null;

/** Raw transcript plus flat token starts (parallel to `@\\S+` in transcript) — for precise pronunciation chip seeks. */
let uploadViewFlatTokenStartsSnapshot = null;

let uploadViewRawTranscriptSnapshot = "";

let uploadViewTranscriptInteractionsWired = false;

function escapeRegExpPhrase(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mirrors `buildInteractiveTranscriptLinesHtml` time slice for one block. */
function uploadViewParagraphTimeRange(parts, totalSec, index) {
  const n = parts.length;
  const safeTotal = Number.isFinite(totalSec) ? Math.max(0, totalSec) : 0;
  let paraStart = 0;
  let paraEnd = safeTotal;
  /** n equal slices of [0,T] — avoids (n-1) math where the last block got span 0 (all words jumped to the end). */
  if (n >= 1 && index >= 0 && index < n) {
    paraStart = safeTotal * (index / n);
    paraEnd = safeTotal * ((index + 1) / n);
  }
  return { paraStart, paraEnd };
}

/**
 * Map a character offset within a paragraph body to the proportion of “token letters”
 * used for transcript word taps (same weighting as {@link buildUploadTranscriptWordButtonsHtml}).
 */
function letterRatioAtCharOffset(body, charOffset) {
  const chunk = String(body ?? "");
  const co = Math.max(0, Math.min(charOffset, chunk.length));
  const hits = [...chunk.matchAll(/\S+/g)];
  if (!hits.length) return 0;
  const totalLetters = hits.reduce((a, wm) => a + wm[0].length, 0);
  let prev = 0;
  for (const wm of hits) {
    const start = wm.index;
    const end = start + wm[0].length;
    if (co <= start) break;
    if (co < end) {
      prev += Math.max(0, co - start);
      break;
    }
    prev += wm[0].length;
  }
  return prev / Math.max(1, totalLetters);
}

function findVerbatimPhraseInBody(body, phrase) {
  const b = String(body ?? "");
  const p = normalizeVisibleCoachCopy(phrase);
  if (!b.trim() || !p) return null;
  const words = p.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const re = new RegExp(words.map((w) => escapeRegExpPhrase(w)).join("\\s+"), "iu");
  const m = b.match(re);
  if (m && m.index != null) return { index: m.index, length: m[0].length };
  const re2 = new RegExp(escapeRegExpPhrase(words[0]), "iu");
  const m2 = b.match(re2);
  if (m2 && m2.index != null) return { index: m2.index, length: m2[0].length };
  return null;
}

/** Expand character span to whole transcript tokens so timings cover the full spoken word(s). */
function extendMatchToWholeTokens(body, index, length) {
  const b = String(body ?? "");
  let start = Math.max(0, index | 0);
  let end = start + Math.max(0, length | 0);
  const hits = [...b.matchAll(/\S+/g)];
  let touched = false;
  for (const wm of hits) {
    const ws = wm.index;
    const we = ws + wm[0].length;
    if (we <= start) continue;
    if (ws >= end) break;
    start = Math.min(start, ws);
    end = Math.max(end, we);
    touched = true;
  }
  if (!touched && hits.length && start <= b.length) {
    const h = hits.find((wm) => wm.index <= start && start < wm.index + wm[0].length);
    if (h) {
      start = h.index;
      end = h.index + h[0].length;
    }
  }
  return { index: start, length: Math.max(1, end - start) };
}

function locateCoachPhraseInUploadParts(parts, phrase) {
  const list = Array.isArray(parts) ? parts : [];
  for (let i = 0; i < list.length; i++) {
    const { body } = parseTranscriptTurnSpeaker(list[i]);
    const hit = findVerbatimPhraseInBody(body, phrase);
    if (hit) return { partIndex: i, body, ...hit };
  }
  return null;
}

/**
 * Approximate [startSec, endSec] for a coach “spoken” snippet using the same interpolated
 * timeline as transcript word buttons (not Whisper word timings).
 */
function estimateCoachSpokenSnippet(phrase, parts, timelineSec, mediaDurationSec) {
  const loc = locateCoachPhraseInUploadParts(parts, phrase);
  if (!loc) return null;

  const tok = extendMatchToWholeTokens(loc.body, loc.index, loc.length);
  const gramLen = [...loc.body.slice(tok.index, tok.index + tok.length)].length || 1;
  const tokenWordCount =
    normalizeVisibleCoachCopy(loc.body.slice(tok.index, tok.index + tok.length))
      .split(/\s+/)
      .filter(Boolean).length || 1;

  const minWordAudio = Math.min(1.2, Math.max(0.3, gramLen * 0.068 + 0.22));
  const maxPhraseAudio =
    tokenWordCount <= 1 ? 1.35 : Math.min(2.5, tokenWordCount * 0.48 + 0.45);

  const tLabel = Number.isFinite(timelineSec) && timelineSec > 0 ? timelineSec : 0;
  const tMedia = Number.isFinite(mediaDurationSec) && mediaDurationSec > 0 ? mediaDurationSec : 0;
  const effective = Math.max(tLabel, tMedia, 1e-3);

  const { paraStart, paraEnd } = uploadViewParagraphTimeRange(parts, effective, loc.partIndex);
  const span = Math.max(0, paraEnd - paraStart);
  let ratioLo = letterRatioAtCharOffset(loc.body, tok.index);
  let ratioHi = letterRatioAtCharOffset(loc.body, tok.index + tok.length);
  if (!Number.isFinite(ratioHi) || ratioHi < ratioLo) ratioHi = ratioLo;

  let startTs = span > 0 ? paraStart + span * ratioLo : paraStart;
  let endTs = span > 0 ? paraStart + span * ratioHi : paraStart;
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return null;

  let slice = endTs - startTs;
  if (slice < minWordAudio) endTs = startTs + minWordAudio;
  slice = endTs - startTs;
  if (slice > maxPhraseAudio) {
    endTs = startTs + maxPhraseAudio;
    slice = endTs - startTs;
    if (slice < minWordAudio) startTs = Math.max(0, endTs - minWordAudio);
  }

  if (tMedia > 0) {
    endTs = Math.min(endTs, tMedia);
    startTs = Math.min(startTs, Math.max(0, endTs - 0.06));
    if (endTs - startTs < 0.25) startTs = Math.max(0, endTs - minWordAudio);
  }
  if (endTs - startTs < 0.22) return null;

  return { startTs, endTs };
}

function waitUploadPlaybackMediaReady(media) {
  return new Promise((resolve) => {
    if (!media) {
      resolve(false);
      return;
    }
    if (Number.isFinite(media.duration) && media.duration > 0) {
      resolve(true);
      return;
    }
    const done = (v) => {
      media.removeEventListener("loadedmetadata", onMeta);
      media.removeEventListener("error", onErr);
      resolve(v);
    };
    const onMeta = () =>
      done(Number.isFinite(media.duration) && media.duration > 0);
    const onErr = () => done(false);
    media.addEventListener("loadedmetadata", onMeta);
    media.addEventListener("error", onErr);
    setTimeout(() => done(Number.isFinite(media.duration) && media.duration > 0), 4800);
  });
}

/**
 * Seek the saved meeting clip to an estimated pronunciation window and **pause** once `endSec`
 * is reached — no mandatory long tail (avoids continuing into following words).
 */
function playCoachRecordingWindow(media, startSec, endSec) {
  if (!media || !Number.isFinite(startSec)) return Promise.resolve(false);
  window.speechSynthesis?.cancel();

  return waitUploadPlaybackMediaReady(media).then((ok) => {
    if (!ok) return false;
    const dur = Number(media.duration);
    if (!Number.isFinite(dur) || dur <= 0) return false;

    const span = Math.max(0, Number(endSec) - Number(startSec));
    const padLead = 0.04;
    const padTail = Math.min(0.16, Math.max(0.08, span * 0.12 + 0.05));
    let t0 = Math.max(0, startSec - padLead);
    let t1 = Math.min(dur, endSec + padTail);
    if (t1 <= t0) t1 = Math.min(dur, t0 + Math.max(0.12, span || 0.25));

    return new Promise((resolve) => {
      let finished = false;
      /** @type {ReturnType<typeof setInterval> | null} */
      let pollId = null;
      /** @type {number | null} */
      let rafId = null;
      /** @type {ReturnType<typeof setTimeout> | null} */
      let safetyId = null;

      const detach = () => {
        media.removeEventListener("ended", onEnded);
        if (pollId != null) {
          clearInterval(pollId);
          pollId = null;
        }
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (safetyId != null) {
          clearTimeout(safetyId);
          safetyId = null;
        }
      };

      const hardStopAtT1 = () => {
        try {
          media.pause();
          if (Number.isFinite(t1) && !media.ended && media.currentTime > t1 + 0.012) {
            media.currentTime = t1;
          }
        } catch (_) {
          /* ignore */
        }
      };

      const finish = (v) => {
        if (finished) return;
        finished = true;
        detach();
        hardStopAtT1();
        resolve(Boolean(v));
      };

      const onEnded = () => finish(true);

      media.addEventListener("ended", onEnded);

      const tick = () => {
        if (finished) return;
        const ct = media.currentTime;
        if (Number.isFinite(ct) && ct >= t1 - 0.008) finish(true);
        else if (!media.paused && !media.ended) rafId = requestAnimationFrame(tick);
      };

      pollId = setInterval(() => {
        if (media.currentTime >= t1 - 0.015) finish(true);
      }, 45);

      const wallSec = Math.max(0.45, ((t1 - t0) + 0.35) / Math.max(Number(media.playbackRate) || 1, 0.2));
      safetyId = setTimeout(() => finish(true), Math.min(60_000, Math.ceil(wallSec * 1000) + 800));

      try {
        media.playbackRate = 1;
        media.currentTime = t0;
      } catch {
        finish(false);
        return;
      }

      media
        .play()
        .then(() => {
          rafId = requestAnimationFrame(tick);
        })
        .catch(() => finish(false));
    });
  });
}

/**
 * Map flat token start times (parallel to `rawTranscript` \\S+ tokens) to per-turn body slices.
 * Locates each speaker block inside `raw` in order (substring search) so we do not require
 * `parts.join("\\n\\n") === raw` — segment reconstruction can differ slightly from stored text.
 */
function bodyWordStartSlicesForParts(parts, flatStarts, rawTranscript) {
  if (!Array.isArray(flatStarts) || !flatStarts.length || !parts.length) return null;
  const raw = String(rawTranscript ?? "").replace(/\r\n/g, "\n").trim();
  const globalToks = raw.match(/\S+/gu) || [];
  if (globalToks.length !== flatStarts.length) return null;

  let cursor = 0;
  const slices = [];

  for (const part of parts) {
    const p = String(part).replace(/\r\n/g, "\n");
    const idx = raw.indexOf(p, cursor);
    if (idx < 0) return null;

    const { body } = parseTranscriptTurnSpeaker(p);
    let bodyStartInPart = p.indexOf(body);
    if (bodyStartInPart < 0) bodyStartInPart = p.indexOf(body.trim());
    if (bodyStartInPart < 0) return null;

    const bodyStartInRaw = idx + bodyStartInPart;
    const prefixRaw = raw.slice(0, bodyStartInRaw);
    const gStart = (prefixRaw.match(/\S+/gu) || []).length;

    const bodyToks = body.match(/\S+/gu) || [];
    const row = [];
    for (let i = 0; i < bodyToks.length; i++) {
      const v = flatStarts[gStart + i];
      row.push(Number.isFinite(v) ? v : 0);
    }
    slices.push(row);
    cursor = idx + p.length;
  }
  return slices;
}

/** Split paragraph into clickable words; optional `explicitWordStartsSec` from Whisper (same length as word tokens). */
function buildUploadTranscriptWordButtonsHtml(text, paraStartSec, paraEndSec, explicitWordStartsSec) {
  const chunk = String(text ?? "");
  const hits = [...chunk.matchAll(/\S+/gu)];
  if (!hits.length) return escapeHtml(chunk);
  const totalLetters = Math.max(
    1,
    hits.reduce((a, wm) => a + wm[0].length, 0),
  );
  const spanSec =
    Number.isFinite(paraEndSec) && Number.isFinite(paraStartSec) ? Math.max(0, paraEndSec - paraStartSec) : 0;
  const explicit =
    Array.isArray(explicitWordStartsSec) && explicitWordStartsSec.length === hits.length;

  let last = 0;
  let html = "";
  hits.forEach((wm, wi) => {
    const ix = wm.index;
    const w = wm[0];
    if (ix > last) html += escapeHtml(chunk.slice(last, ix));
    const prevLen =
      wi === 0 ? 0 : hits.slice(0, wi).reduce((acc, h) => acc + h[0].length, 0);
    let ts;
    if (explicit && Number.isFinite(explicitWordStartsSec[wi])) {
      ts = explicitWordStartsSec[wi];
    } else {
      ts = spanSec > 0 ? paraStartSec + spanSec * (prevLen / totalLetters) : paraStartSec;
    }
    const tsAttr = Number.isFinite(ts) ? String(+ts.toFixed(4)) : "0";
    html += `<button type="button" class="transcript-word" data-ts="${escapeHtml(tsAttr)}" title="Jump to ${escapeHtml(formatMmSs(ts))}">${escapeHtml(w)}</button>`;
    last = ix + w.length;
  });
  if (last < chunk.length) html += escapeHtml(chunk.slice(last));
  return html;
}

/**
 * Use max(stored label duration, media.duration) so word taps align with the real file
 * (stored mm:ss is floored; label can be 00:00 for legacy rows).
 */
function syncUploadTranscriptTimelineToMedia(media) {
  if (!media || !uploadViewTranscriptPartsSnapshot.length) return;
  const linesRoot = document.getElementById("transcriptLines");
  if (!linesRoot) return;

  const mediaDur = Number(media.duration);
  const labelSec = Number.isFinite(uploadViewDurationLabelSec) ? Math.max(0, uploadViewDurationLabelSec) : 0;
  const effective =
    Number.isFinite(mediaDur) && mediaDur > 0 ? Math.max(labelSec, mediaDur) : labelSec;
  if (!Number.isFinite(effective) || effective <= 0) return;

  if (Math.abs(effective - uploadViewTimelineSecSnapshot) < 0.02) return;

  uploadViewTimelineSecSnapshot = effective;
  linesRoot.innerHTML = buildInteractiveTranscriptLinesHtml(
    uploadViewTranscriptPartsSnapshot,
    effective,
    uploadViewBodyStartsSlicesSnapshot,
  );
}

/**
 * Seek toward transcript timestamp. WebM/MP4 often land on earlier keyframes; we step seeked until within ~80ms or max steps.
 * (Muted fast-forward RAF was flaky with Chrome + short safety timeouts.)
 */
function seekMediaToTranscriptSeconds(media, targetSec) {
  if (!media) return;
  const want = Math.max(0, Number(targetSec) || 0);
  const dur = Number(media.duration);
  const cap =
    Number.isFinite(dur) && dur > 0 ? Math.min(want, Math.max(0, dur - 0.001)) : want;

  const wasMuted = Boolean(media.muted);
  let tries = 0;
  /** Enough steps for chunky keyframes; each step adjusts currentTime. */
  const maxTries = 28;
  let safetyId = null;

  const done = () => {
    if (safetyId != null) {
      clearTimeout(safetyId);
      safetyId = null;
    }
    media.removeEventListener("seeked", onSeeked);
    media.muted = wasMuted;
    media.play().catch(() => {});
  };

  /** Wall-clock fallback — must exceed slow keyframe seeks + multi-step ramps. */
  const safetyMs =
    Number.isFinite(dur) && dur > 0 ? Math.min(35000, 1600 + Math.ceil(dur) * 700) : 8000;

  function onSeeked() {
    tries++;
    const ct = Number(media.currentTime);

    const gap =
      Number.isFinite(ct) && Number.isFinite(cap)
        ? cap - ct
        : NaN;

    if (Number.isFinite(gap) && gap <= 0.05) {
      done();
      return;
    }

    if (Number.isFinite(gap) && gap > 0.082 && tries < maxTries) {
      /** Fractional leaps work better than tiny bumps on VP9/WebM. */
      const leap = Math.min(gap - 1e-3, Math.max(0.04, gap * 0.62));
      try {
        const next = Math.min(cap - 5e-4, ct + leap);
        const maxT = Number.isFinite(dur) && dur > 0 ? dur : next;
        media.currentTime = Math.min(next, maxT);
      } catch {
        done();
      }
      return;
    }

    /** Final glue: one hard set if we're still visibly short */
    if (Number.isFinite(gap) && gap > 0.06 && tries < maxTries) {
      try {
        media.currentTime = cap;
      } catch {
        done();
      }
      return;
    }

    done();
  }

  media.addEventListener("seeked", onSeeked);
  safetyId = setTimeout(done, safetyMs);

  try {
    media.currentTime = cap;
  } catch {
    done();
  }
}

/** Parse "Speaker A: …", "Maria: …", "Ahmet Demir: …" prefix from each transcript block. */
function parseTranscriptTurnSpeaker(raw) {
  const b = String(raw ?? "").trim();
  const m = b.match(
    /^((?:Speaker\s+(?:[A-Z]|[0-9]{1,2}))|(?:[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}))\s*:\s*([\s\S]*)$/u,
  );
  if (m) {
    let label = `${m[1]}`.replace(/\s+/g, " ").trim();
    if (/^speaker\s+[A-Za-z0-9]/i.test(label)) {
      label = label.replace(/^speaker/i, "Speaker");
      const sub = label.match(/^Speaker\s+(.+)$/i);
      const idRaw = sub ? String(sub[1]).trim() : "";
      let pretty = label;
      if (/^[a-z]$/.test(idRaw)) pretty = `Speaker ${idRaw.toUpperCase()}`;
      else if (/^[A-Z]$/i.test(idRaw)) pretty = `Speaker ${idRaw.toUpperCase()}`;
      else if (/^\d+$/.test(idRaw)) pretty = `Speaker ${idRaw}`;
      const body = (m[2] || "").trim();
      return { speakerLabel: pretty, body: body || "\u2014" };
    }
    const pretty = label.replace(/\s+/g, " ").trim();
    const body = (m[2] || "").trim();
    return { speakerLabel: pretty, body: body || "\u2014" };
  }
  return { speakerLabel: "Speaker", body: b };
}

/** Initials inside avatar; supports Speaker A vs real names with Unicode graphemes (e.g. İ, Ö). */
function transcriptSpeakerBadgeLetter(speakerLabel) {
  const s = String(speakerLabel ?? "").trim();
  if (/^speaker\s+[A-Za-z0-9]/i.test(s)) {
    const m = s.match(/^Speaker\s+([A-Z0-9]{1,2})/i);
    return (m ? m[1] : "S").toUpperCase().slice(0, 2);
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const g = [...parts[0]].slice(0, 2).join("");
    return g.toLocaleUpperCase("tr");
  }
  const head = [...parts[0]][0] || "?";
  const tail = [...parts[parts.length - 1]][0] || "?";
  return `${head}${tail}`.toLocaleUpperCase("tr");
}

function buildInteractiveTranscriptLinesHtml(parts, totalSec, bodyStartsSlices) {
  const n = parts.length;
  const safeTotal = Number.isFinite(totalSec) ? Math.max(0, totalSec) : 0;
  return parts
    .map((text, i) => {
      const { paraStart, paraEnd } = uploadViewParagraphTimeRange(parts, safeTotal, i);
      const clock = formatMmSs(paraStart);
      const { speakerLabel, body } = parseTranscriptTurnSpeaker(text);
      const slice =
        Array.isArray(bodyStartsSlices) &&
        Array.isArray(bodyStartsSlices[i]) &&
        bodyStartsSlices[i].length
          ? bodyStartsSlices[i]
          : null;
      const bodyHtml = buildUploadTranscriptWordButtonsHtml(body, paraStart, paraEnd, slice);
      const icon = escapeHtml(transcriptSpeakerBadgeLetter(speakerLabel));
      const tone = thumbHueClass(speakerLabel);
      const nameEsc = escapeHtml(speakerLabel);
      return `
    <article class="transcript-line">
      <div class="transcript-speaker-icon ${tone}" aria-hidden="true">${icon}</div>
      <div class="transcript-line-body">
        <div class="transcript-line-meta">
          <span class="transcript-speaker-name">${nameEsc}</span>
          <span class="transcript-time">${clock}</span>
        </div>
        <div class="transcript-line-text">${bodyHtml}</div>
      </div>
    </article>`;
    })
    .join("");
}

function ensureUploadViewTranscriptInteractions() {
  if (uploadViewTranscriptInteractionsWired) return;
  uploadViewTranscriptInteractionsWired = true;

  document.getElementById("transcriptLines")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".transcript-word[data-ts]");
    if (!chip) return;
    const ts = Number.parseFloat(chip.getAttribute("data-ts") || "");
    if (!Number.isFinite(ts)) return;
    const media = uploadViewPlaybackMedia;
    if (!media) {
      const eb = document.getElementById("pageError");
      if (eb) {
        eb.textContent = "No saved recording — word seek needs a playable file.";
        setTimeout(() => {
          eb.textContent = "";
        }, 3200);
      }
      return;
    }
    seekMediaToTranscriptSeconds(media, ts);
  });

  document.getElementById("uploadTransportSkillsStub")?.addEventListener("click", () => {
    document.querySelector("[data-upload-tab='skills']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setTimeout(() => {
      document.getElementById("uploadViewSkillsGenerate")?.focus({ preventScroll: true });
      document.getElementById("uploadViewSkillsMount")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
  });
}

function wireUploadViewTransport(media, opts) {
  const transport = document.getElementById("uploadTranscriptTransport");
  const timeEl = document.getElementById("uploadTransportTime");
  const speedBtn = document.getElementById("uploadTransportSpeed");
  const rewindBtn = document.getElementById("uploadTransportRewind");
  const playBtn = document.getElementById("uploadTransportPlay");
  const forwardBtn = document.getElementById("uploadTransportForward");
  const downloadLink = document.getElementById("uploadTransportDownload");
  const iconPlay = playBtn?.querySelector(".upload-transport-icon-play");
  const iconPause = playBtn?.querySelector(".upload-transport-icon-pause");
  if (
    !transport ||
    !timeEl ||
    !speedBtn ||
    !rewindBtn ||
    !playBtn ||
    !forwardBtn ||
    !downloadLink ||
    !media ||
    !opts?.src
  ) {
    return;
  }

  transport.classList.remove("hidden");
  const src = opts.src;
  const fileLabel = (opts.downloadName || "recording").replace(/[/\\?%*:|"<>]/g, "_");
  downloadLink.href = src;
  downloadLink.setAttribute("download", fileLabel);

  let speedIdx = UPLOAD_PLAYBACK_SPEEDS.indexOf(media.playbackRate);
  if (speedIdx < 0) speedIdx = 1;

  const renderSpeedLabel = () => {
    const r = UPLOAD_PLAYBACK_SPEEDS[speedIdx];
    speedBtn.textContent = r === 1 ? "1x" : `${r}x`;
  };

  const syncPlayUi = () => {
    const paused = media.paused;
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
    playBtn.setAttribute("title", paused ? "Play" : "Pause");
    iconPlay?.classList.toggle("hidden", !paused);
    iconPause?.classList.toggle("hidden", paused);
  };

  const updateTime = () => {
    const cur = media.currentTime || 0;
    const dur = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
    timeEl.textContent = `${formatTransportClock(cur)} / ${formatTransportClock(dur || 0)}`;
  };

  media.playbackRate = UPLOAD_PLAYBACK_SPEEDS[speedIdx];
  renderSpeedLabel();
  syncPlayUi();
  updateTime();

  speedBtn.onclick = () => {
    speedIdx = (speedIdx + 1) % UPLOAD_PLAYBACK_SPEEDS.length;
    media.playbackRate = UPLOAD_PLAYBACK_SPEEDS[speedIdx];
    renderSpeedLabel();
  };

  playBtn.onclick = () => {
    if (media.paused) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  };

  rewindBtn.onclick = () => {
    media.currentTime = Math.max(0, (media.currentTime || 0) - 10);
  };

  forwardBtn.onclick = () => {
    const dur = Number.isFinite(media.duration) ? media.duration : Infinity;
    media.currentTime = Math.min(dur, (media.currentTime || 0) + 10);
  };

  const scrub = document.getElementById("uploadTransportScrub");
  let scrubDragging = false;

  const syncScrubSlider = () => {
    if (!scrub || scrubDragging) return;
    const dur = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
    if (dur <= 0) {
      scrub.value = "0";
      return;
    }
    const pct = Math.min(1000, Math.round((1000 * (media.currentTime || 0)) / dur));
    if (scrub.value !== String(pct)) scrub.value = String(pct);
  };

  scrub?.addEventListener("pointerdown", () => {
    scrubDragging = true;
  });
  scrub?.addEventListener("pointerup", () => {
    scrubDragging = false;
    syncScrubSlider();
  });
  scrub?.addEventListener("pointercancel", () => {
    scrubDragging = false;
    syncScrubSlider();
  });
  scrub?.addEventListener("change", syncScrubSlider);
  scrub?.addEventListener("input", () => {
    const dur = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
    if (!scrub || dur <= 0) return;
    media.currentTime = (Number(scrub.value) / 1000) * dur;
  });

  media.addEventListener("timeupdate", () => {
    updateTime();
    syncScrubSlider();
  });
  media.addEventListener("loadedmetadata", () => {
    updateTime();
    syncScrubSlider();
    syncUploadTranscriptTimelineToMedia(media);
  });
  media.addEventListener("durationchange", () => {
    updateTime();
    syncScrubSlider();
    syncUploadTranscriptTimelineToMedia(media);
  });
  media.addEventListener("seeked", syncScrubSlider);
  media.addEventListener("play", syncPlayUi);
  media.addEventListener("pause", syncPlayUi);
  media.addEventListener("ended", syncPlayUi);
  syncScrubSlider();
}

function readMediaDuration(file) {
  return new Promise((resolve) => {
    const media = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      URL.revokeObjectURL(media.src);
      resolve(formatDuration(duration));
    };
    media.onerror = () => {
      URL.revokeObjectURL(media.src);
      resolve("00:00");
    };
    media.src = URL.createObjectURL(file);
  });
}

let meetingsHubWired = false;
let meetingsHubRows = [];

function durationToMinutesLabel(durStr) {
  const sec = parseDurationLabelToSeconds(durStr);
  if (sec <= 0) return "0 min";
  const minutes = Math.max(1, Math.round(sec / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m} min` : `${h} hr`;
}

function initialsFromTitle(title) {
  const parts = String(title ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function thumbHueClass(seed) {
  let h = 0;
  const s = String(seed ?? "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `meetings-thumb-tone-${h % 5}`;
}

function formatMeetingSubtitle(m) {
  const owner = escapeHtml(((m.ownerLabel && String(m.ownerLabel).trim()) || "You").trim());
  const mins = escapeHtml(durationToMinutesLabel(m.duration));
  const t = Date.parse(m.recordedAt || "");
  if (Number.isFinite(t)) {
    const d = new Date(t);
    const day = escapeHtml(`${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    const tim = escapeHtml(d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
    return `${day} - ${tim} · ${mins} · ${owner}`;
  }
  const fallbackDate = escapeHtml(String(m.date || "—"));
  return `${fallbackDate} · ${mins} · ${owner}`;
}

function groupMeetingsByLocalDayDescending(rows) {
  const map = new Map();
  rows.forEach((m) => {
    const ts = Date.parse(m.recordedAt || "") || Date.now();
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
      2,
      "0"
    )}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  });
  for (const arr of map.values()) {
    arr.sort((a, b) => (Date.parse(b.recordedAt) || 0) - (Date.parse(a.recordedAt) || 0));
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  const thisYear = new Date().getFullYear();
  return keys.map((key) => {
    const [y, mo, dd] = key.split("-").map(Number);
    const d = new Date(y, mo - 1, dd);
    const heading = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(d.getFullYear() !== thisYear ? { year: "numeric" } : {}),
    });
    return { heading, meetings: map.get(key) };
  });
}

function parseMeetingMetaFromButton(btn) {
  const raw = btn.getAttribute("data-meeting-meta");
  try {
    return JSON.parse(decodeURIComponent(raw || "%7B%7D"));
  } catch {
    return {};
  }
}

async function handleMeetingQuickAction(cmd, meta) {
  const uploadId = meta.uploadId || "";
  const meetingId = meta.id || "";
  const shareUrl = meetingId.trim()
    ? `${window.location.origin}/upload-view.html?meetingId=${encodeURIComponent(meetingId)}`
    : uploadId.trim()
      ? `${window.location.origin}/upload-view.html?id=${encodeURIComponent(uploadId)}`
      : `${window.location.origin}/meetings.html`;

  async function toast(msg) {
    const el = document.getElementById("pageError");
    if (el && msg) el.textContent = msg;
    if (msg) setTimeout(() => el && (el.textContent = ""), 3200);
  }

  async function writeClip(text) {
    try {
      await navigator.clipboard.writeText(text);
      await toast("Link copied.");
    } catch {
      await toast("Could not copy — copy the address from the browser bar.");
    }
  }

  switch (cmd) {
    case "share": {
      if (navigator.share) {
        try {
          await navigator.share({ url: shareUrl, title: meta.title || "Meeting" });
        } catch (e) {
          if (e.name !== "AbortError") await writeClip(shareUrl);
        }
      } else await writeClip(shareUrl);
      break;
    }
    case "copy-link":
      await writeClip(shareUrl);
      break;
    case "download": {
      const ref = (meta.recordingRef || "").trim();
      if (!ref) {
        await toast("No saved recording file for this meeting.");
        return;
      }
      const a = document.createElement("a");
      a.href = `/recordings/${encodeURIComponent(ref)}`;
      a.download = ref.split(/[/\\\\]/).pop() || "recording";
      a.rel = "noopener";
      a.click();
      break;
    }
    case "move-channel":
      await toast("Channels are not available yet in this MVP.");
      break;
    case "rename": {
      const next = await showAppPrompt({
        title: "Rename meeting",
        message: "Update how this session appears in your list.",
        label: "Meeting title",
        defaultValue: meta.title || "",
        confirmLabel: "Save",
        cancelLabel: "Cancel",
      });
      if (next === null || !String(next).trim()) return;
      await fetchJson(`/api/meetings/${encodeURIComponent(meta.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: String(next).trim() }),
      });
      await toast("Meeting renamed.");
      await loadMeetingsPage();
      break;
    }
    case "delete": {
      const ok = await showAppConfirm({
        title: "Delete meeting?",
        message:
          "This removes the meeting from your list. If it came from an upload, the linked upload and saved recording file are removed as well.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!ok) return;
      await fetchJson(`/api/meetings/${encodeURIComponent(meta.id)}`, { method: "DELETE" });
      await loadMeetingsPage();
      break;
    }
    default:
      break;
  }
}

function syncMeetingsVoiceSelect() {
  const sel = document.getElementById("meetingsVoiceMeetingSelect");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const rows = Array.isArray(meetingsHubRows) ? meetingsHubRows : [];
  const opts = rows.filter((m) => {
    const ts = String(m.transcriptStatus || "").toLowerCase();
    return ts === "ready" && (String(m.transcript || "").trim().length > 0 || m.uploadId);
  });
  if (!opts.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "No transcribed meetings yet";
    sel.appendChild(o);
    return;
  }
  for (const m of opts) {
    const o = document.createElement("option");
    o.value = String(m.id);
    o.textContent = m.title || "Untitled";
    sel.appendChild(o);
  }
  if (prev && [...sel.options].some((x) => x.value === prev)) sel.value = prev;
}

async function transcriptForVoiceMeeting(meetingId) {
  const detail = await fetchJson(`/api/dashboard/meetings/${encodeURIComponent(meetingId)}`);
  const m = detail.meeting || {};
  let t = String(m.transcript || "").trim();
  if (!t && m.uploadId) {
    const ud = await fetchJson(`/api/dashboard/uploads/${encodeURIComponent(m.uploadId)}`);
    t = String(ud.upload?.transcript || "").trim();
  }
  return t;
}

function wireMeetingsVoiceTabOnce() {
  const sec = document.getElementById("meetingsVoiceSection");
  if (!sec || sec.dataset.wired === "1") return;
  sec.dataset.wired = "1";

  const tabs = document.querySelectorAll("[data-meetings-tab]");
  const listEls = document.querySelectorAll(".meetings-hub-list-mode");
  const setMode = (mode) => {
    listEls.forEach((el) => el.classList.toggle("hidden", mode === "voice"));
    sec.classList.toggle("hidden", mode !== "voice");
    tabs.forEach((b) => {
      b.classList.toggle("meetings-subnav-pill-active", b.getAttribute("data-meetings-tab") === mode);
    });
    if (mode === "voice") syncMeetingsVoiceSelect();
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-meetings-tab") || "list"));
  });

  const Sr = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = document.getElementById("meetingsVoiceSrStatus");
  const mic = document.getElementById("meetingsVoiceMicBtn");
  const ta = document.getElementById("meetingsVoiceQuestion");
  const out = document.getElementById("meetingsVoiceAnswer");
  const ask = document.getElementById("meetingsVoiceAskBtn");

  if (!Sr) {
    if (mic) mic.disabled = true;
    if (status) status.textContent = "Speech recognition is not supported in this browser.";
  } else if (mic && ta) {
    const rec = new Sr();
    rec.lang = (document.documentElement.lang || "en").slice(0, 2) === "tr" ? "tr-TR" : "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const line = ev.results[0][0].transcript;
      ta.value = `${ta.value}${ta.value.trim() ? " " : ""}${line}`.trim();
      if (status) status.textContent = "Captured.";
    };
    rec.onerror = (ev) => {
      if (status) {
        status.textContent =
          ev.error === "not-allowed" ? "Microphone denied." : String(ev.error || "Speech error");
      }
    };
    mic.addEventListener("click", () => {
      if (status) status.textContent = "Listening…";
      try {
        rec.start();
      } catch {
        if (status) status.textContent = "Already listening — wait or type your question.";
      }
    });
  }

  ask?.addEventListener("click", async () => {
    const mid = document.getElementById("meetingsVoiceMeetingSelect")?.value;
    const q = ta?.value?.trim();
    if (!mid || !q) {
      if (out) out.textContent = "Pick a meeting and enter a question.";
      return;
    }
    ask.disabled = true;
    if (out) out.textContent = "";
    try {
      const transcript = await transcriptForVoiceMeeting(mid);
      if (!transcript) {
        if (out) out.textContent = "That meeting has no transcript yet.";
        return;
      }
      const m = meetingsHubRows.find((x) => String(x.id) === String(mid));
      const role = String(m?.role || "Meeting participant");
      const purpose = String(m?.purpose || "General discussion");
      const vf = normalizeCoachFocusForSave(m?.coachFocusSpeaker ?? "");
      const data = await fetchJson("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          question: q,
          role,
          purpose,
          ...(vf ? { coachFocusSpeaker: vf } : {}),
        }),
      });
      if (out) out.textContent = data.answer || "—";
    } catch (e) {
      if (out) out.textContent = e.message || "Request failed.";
    } finally {
      ask.disabled = false;
    }
  });
}

function wireMeetingsHub() {
  if (meetingsHubWired) return;
  meetingsHubWired = true;

  const kbdHint = document.getElementById("meetingsSearchKbdHint");
  if (kbdHint && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || "")) {
    kbdHint.textContent = "⌘ K";
  }

  document.addEventListener("keydown", (e) => {
    if (document.body.dataset.page !== "meetings") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("meetingsGlobalSearch")?.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (document.body.dataset.page !== "meetings") return;
    const rowBtn = e.target.closest("button[data-meeting-cmd]");
    if (rowBtn) {
      e.preventDefault();
      const cmd = rowBtn.getAttribute("data-meeting-cmd");
      const meta = parseMeetingMetaFromButton(rowBtn);
      handleMeetingQuickAction(cmd, meta);
      rowBtn.closest("details.meeting-actions-dd")?.removeAttribute("open");
      return;
    }
    if (e.target.closest(".meeting-actions-dd")) return;
    document.querySelectorAll("details.meeting-actions-dd[open]").forEach((d) => d.removeAttribute("open"));
  });

  document.getElementById("meetingsGlobalSearch")?.addEventListener("input", renderMeetingsHubFromFilters);
  document.getElementById("meetingsTranscriptFilter")?.addEventListener("change", renderMeetingsHubFromFilters);
}

function renderMeetingHubCard(m) {
  const mid = m.id ? encodeURIComponent(String(m.id)) : "";
  const detailsHref = mid ? `/upload-view.html?meetingId=${mid}` : "#";

  const uploadIdRaw = m.uploadId ? String(m.uploadId) : "";

  const titleInner = mid
    ? `<a href="/upload-view.html?meetingId=${mid}" class="meeting-row-title-link">${escapeHtml(m.title)}</a>`
    : `<span class="meeting-row-title-text">${escapeHtml(m.title)}</span>`;

  const metaPayload = encodeURIComponent(
    JSON.stringify({
      id: m.id || "",
      title: m.title || "",
      uploadId: uploadIdRaw,
      recordingRef: m.recordingRef || "",
    })
  );

  const menuBtn = (cmd, svg, label, extra = "") =>
    `<button type="button" class="meeting-menu-item ${extra}" data-meeting-cmd="${cmd}" data-meeting-meta="${metaPayload}">
       <span class="meeting-menu-ico-wrap">${svg}</span>
       <span class="meeting-menu-label">${label}</span>
     </button>`;

  const detailsLink = mid
    ? `<a class="meeting-row-details" href="${detailsHref}">Details ›</a>`
    : `<span class="meeting-row-details meeting-row-details--disabled">Details ›</span>`;

  return `
    <article class="meeting-row-card">
      <span class="meeting-row-check-wrap" aria-hidden="true"><input type="checkbox" class="meeting-row-check" tabindex="-1" /></span>
      <div class="meeting-row-thumb ${thumbHueClass(m.title)}">${escapeHtml(initialsFromTitle(m.title))}</div>
      <div class="meeting-row-main">
        <div class="meeting-row-titleline">${titleInner}</div>
        <div class="meeting-row-meta">${formatMeetingSubtitle(m)}</div>
        <div class="meeting-row-chips">
          <span class="badge badge-tight ${badgeClass(m.transcriptStatus)}">${prettyStatus(m.transcriptStatus)}</span>
          <span class="badge badge-tight ${badgeClass(m.coachStatus)}">${prettyStatus(m.coachStatus)}</span>
        </div>
      </div>
      <div class="meeting-row-actions">
        <details class="meeting-actions-dd">
          <summary class="meeting-actions-kebab" title="More" aria-label="More actions">${"\u22EF"}</summary>
          <div class="meeting-actions-dropdown" role="menu">
            ${menuBtn("share", meetingMenuSVGShare(), "Share")}
            ${menuBtn("copy-link", meetingMenuSVGCopy(), "Copy link")}
            ${menuBtn("download", meetingMenuSVGDownload(), "Download")}
            ${menuBtn("move-channel", meetingMenuSVGMove(), "Move to channel")}
            ${menuBtn("rename", meetingMenuSVGText(), "Rename")}
            <hr class="meeting-menu-rule" />
            ${menuBtn("delete", meetingMenuSVGTrash(), "Delete", "meeting-menu-item--danger")}
          </div>
        </details>
        ${detailsLink}
      </div>
    </article>
  `;
}

function renderMeetingsHubFromFilters() {
  const mount = document.getElementById("meetingsGroupedMount");
  const footer = document.getElementById("meetingsListEndFooter");
  if (!mount) return;

  const qRaw = document.getElementById("meetingsGlobalSearch")?.value ?? "";
  const q = qRaw.trim().toLowerCase();
  const f = document.getElementById("meetingsTranscriptFilter")?.value ?? "all";

  let filtered = [...meetingsHubRows];
  if (q) {
    filtered = filtered.filter((m) => {
      const asum =
        m.analysis && typeof m.analysis.summary === "string" ? m.analysis.summary : "";
      const hay = `${m.title ?? ""} ${m.ownerLabel ?? ""} ${m.date ?? ""} ${m.transcript ?? ""} ${m.summary ?? ""} ${asum}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (f !== "all") {
    filtered = filtered.filter((m) => {
      const ts = String(m.transcriptStatus || "").toLowerCase();
      if (f === "ready") return ts === "ready";
      if (f === "processing") return ts === "processing";
      return ts !== "ready" && ts !== "processing";
    });
  }

  if (!filtered.length) {
    mount.innerHTML =
      `<p class="muted meetings-empty-hint">No meetings match these filters.` +
      (q ? " Try another search keyword." : "") +
      `</p>`;
    if (footer) footer.style.display = "none";
    return;
  }

  const groups = groupMeetingsByLocalDayDescending(filtered);
  mount.innerHTML = groups
    .map(
      (g) => `
    <section class="meeting-date-block">
      <h2 class="meeting-date-heading">${escapeHtml(g.heading)}</h2>
      <div class="meeting-cards">${g.meetings.map(renderMeetingHubCard).join("")}</div>
    </section>
  `
    )
    .join("");
  if (footer) footer.style.display = "block";
}

async function loadMeetingsPage() {
  const data = await fetchJson("/api/dashboard/meetings");
  meetingsHubRows = Array.isArray(data.meetings) ? data.meetings : [];

  const qParam = new URLSearchParams(window.location.search).get("q");
  const searchInput = document.getElementById("meetingsGlobalSearch");
  if (qParam != null && searchInput) {
    searchInput.value = qParam;
  }

  document.getElementById("kpiTotalMeetings").textContent = data.kpis.totalMeetings;
  document.getElementById("kpiTranscriptsReady").textContent = data.kpis.transcriptsReady;
  document.getElementById("kpiNeedsReview").textContent = data.kpis.needsReview;

  wireMeetingsHub();
  renderMeetingsHubFromFilters();

  const newCaptureBtn = document.getElementById("newCaptureBtn");
  const viewLastTranscriptBtn = document.getElementById("viewLastTranscriptBtn");
  if (newCaptureBtn) {
    newCaptureBtn.onclick = () => {
      window.location.href = "/index.html";
    };
  }
  if (viewLastTranscriptBtn) {
    viewLastTranscriptBtn.onclick = () => {
      window.location.href = "/index.html#transcript";
    };
  }

  const meetingsCalRefresh = document.getElementById("meetingsGoogleCalRefreshBtn");
  if (meetingsCalRefresh && !meetingsCalRefresh.dataset.wired) {
    meetingsCalRefresh.dataset.wired = "1";
    meetingsCalRefresh.addEventListener("click", () => {
      void refreshMeetingsGoogleCalendarSection();
    });
  }
  await refreshMeetingsGoogleCalendarSection();

  wireMeetingsVoiceTabOnce();
  syncMeetingsVoiceSelect();
}

async function loadUploadsPage() {
  const data = await fetchJson("/api/dashboard/uploads");
  document.getElementById("uploadPendingJobs").textContent = `${data.pendingJobs} active jobs in queue.`;
  document.getElementById(
    "uploadFormats"
  ).innerHTML = `<li>Audio: ${data.acceptedFormats.audio.join(", ")}</li><li>Video: ${data.acceptedFormats.video.join(", ")}</li><li>Max file size: ${data.acceptedFormats.maxSize}</li>`;

  const maxUploadBytes =
    typeof data.maxUploadBytes === "number" ? data.maxUploadBytes : 1024 * 1024 * 1024;
  const maxMbRounded = Math.round(maxUploadBytes / (1024 * 1024));
  const hintEl = document.getElementById("uploadLimitHint");
  if (hintEl) {
    hintEl.textContent = `You can upload up to about ${maxMbRounded} MB. Long videos are shrunk to mono speech-quality audio on the server, then transcribed in ~25 MB pieces — processing may take a few minutes.`;
  }

  const tbody = document.getElementById("uploadsTableBody");

  tbody.innerHTML = (data.uploads || [])
    .map((u) => {
      const hasTx = Boolean(u.transcript && String(u.transcript).trim());
      const vid = encodeURIComponent(u.id);
      const openHref = `/upload-view.html?id=${vid}`;
      return `
      <tr class="uploads-table-row" data-upload-href="${openHref}" tabindex="0" title="Open recording">
        <td>${escapeHtml(u.file)}</td>
        <td>${escapeHtml(u.type)}</td>
        <td>${escapeHtml(u.duration)}</td>
        <td><span class="badge ${badgeClass(u.status)}">${prettyStatus(u.status)}</span></td>
        <td><span class="muted">${hasTx ? "Available" : "—"}</span></td>
      </tr>`;
    })
    .join("");

  if (tbody && !tbody.dataset.uploadNavWired) {
    tbody.dataset.uploadNavWired = "1";
    tbody.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const tr = e.target.closest("tr[data-upload-href]");
      if (!tr) return;
      const href = tr.getAttribute("data-upload-href");
      if (href) window.location.href = href;
    });
    tbody.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const tr = e.target.closest("tr[data-upload-href]");
      if (!tr || !tbody.contains(tr)) return;
      if (e.target.closest("a")) return;
      e.preventDefault();
      const href = tr.getAttribute("data-upload-href");
      if (href) window.location.href = href;
    });
  }

  const uploadBtn = document.getElementById("uploadStartBtn");
  const fileInput = document.getElementById("uploadFileInput");
  const statusEl = document.getElementById("uploadActionStatus");
  const focusBtn = document.getElementById("uploadFocusBtn");

  if (focusBtn) {
    focusBtn.onclick = () => fileInput?.click();
  }

  if (uploadBtn && fileInput && statusEl) {
    uploadBtn.onclick = async () => {
      try {
        const file = fileInput.files?.[0];
        if (!file) {
          statusEl.textContent = "Please select a file first.";
          return;
        }

        if (file.size > maxUploadBytes) {
          statusEl.textContent = `This file is about ${formatMegabytes(file.size)} MB — the limit is ${maxMbRounded} MB. Compress, trim, or split the recording and try again.`;
          return;
        }

        statusEl.textContent = "Uploading and transcribing...";
        uploadBtn.disabled = true;

        const formData = new FormData();
        formData.append("audio", file, file.name);
        const uploadHostEl = document.getElementById("uploadHostName");
        const uploadRoleEl = document.getElementById("uploadRole");
        const uploadPurposeEl = document.getElementById("uploadPurpose");
        const hostCtx = uploadHostEl ? String(uploadHostEl.value || "").trim() : "";
        const roleCtx = uploadRoleEl ? String(uploadRoleEl.value || "").trim() : "";
        const purposeCtx = uploadPurposeEl ? String(uploadPurposeEl.value || "").trim() : "";
        if (hostCtx) formData.append("hostName", hostCtx);
        if (roleCtx) formData.append("role", roleCtx);
        if (purposeCtx) formData.append("purpose", purposeCtx);
        const transcribePayload = await fetchJson("/api/transcribe", { method: "POST", body: formData });

        const fileType = file.type.startsWith("video") ? "Video" : "Audio";
        const duration = await readMediaDuration(file);
        await fetchJson("/api/dashboard/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: file.name,
            type: fileType,
            duration,
            status: "transcribed",
            transcript: transcribePayload.transcript ?? "",
            ...(roleCtx ? { role: roleCtx } : {}),
            ...(purposeCtx ? { purpose: purposeCtx } : {}),
            ...(transcribePayload.recordingRef
              ? { recordingRef: transcribePayload.recordingRef }
              : {}),
            ...(Array.isArray(transcribePayload.transcriptTokenStartsSec) &&
            transcribePayload.transcriptTokenStartsSec.length
              ? { transcriptTokenStartsSec: transcribePayload.transcriptTokenStartsSec }
              : {}),
          }),
        });

        statusEl.textContent = "Upload and transcription completed.";
        fileInput.value = "";
        await loadUploadsPage();
      } catch (error) {
        statusEl.textContent = `Upload failed: ${error.message}`;
      } finally {
        uploadBtn.disabled = false;
      }
    };
  }
}

async function loadUploadViewPage() {
  const errBox = document.getElementById("pageError");
  if (errBox) errBox.textContent = "";
  ensureUploadViewTranscriptInteractions();

  const params = new URLSearchParams(window.location.search);
  const uploadIdParam = params.get("id");
  const meetingIdParam = params.get("meetingId");

  let upload = null;
  let meeting = null;

  try {
    if (meetingIdParam) {
      const mr = await fetchJson(`/api/dashboard/meetings/${encodeURIComponent(meetingIdParam)}`);
      meeting = mr.meeting;
      if (meeting.uploadId) {
        try {
          const ur = await fetchJson(`/api/dashboard/uploads/${encodeURIComponent(meeting.uploadId)}`);
          upload = ur.upload;
        } catch {
          upload = null;
        }
      }
    } else if (uploadIdParam) {
      const ur = await fetchJson(`/api/dashboard/uploads/${encodeURIComponent(uploadIdParam)}`);
      upload = ur.upload;
    } else {
      if (errBox) errBox.textContent = "Open this page from Meetings or Uploads (missing id).";
      return;
    }
  } catch (e) {
    if (errBox) errBox.textContent = e.message || "Could not load this recording.";
    return;
  }

  const displayTitle =
    (upload && upload.file) || (meeting && meeting.title) || "Recording";
  const displayType =
    (upload && upload.type) || "Audio";
  const displayDuration =
    (upload && upload.duration) || (meeting && meeting.duration) || "00:00";
  const displayStatus =
    (upload && upload.status) ||
    (meeting && meeting.transcriptStatus) ||
    "ready";
  const displayTranscript =
    (upload && upload.transcript) || (meeting && meeting.transcript) || "";
  const displayRecordingRef =
    (upload && upload.recordingRef) || (meeting && meeting.recordingRef) || "";

  const transportRoot = document.getElementById("uploadTranscriptTransport");
  if (transportRoot) transportRoot.classList.add("hidden");
  uploadViewPlaybackMedia = null;

  const titleEl = document.getElementById("uploadViewTitle");
  const metaEl = document.getElementById("uploadViewMeta");
  if (titleEl) titleEl.textContent = displayTitle;

  const metaPieces = [
    displayType || null,
    displayDuration ? `Duration ${displayDuration}` : null,
    displayStatus ? prettyStatus(String(displayStatus)) : null,
    displayRecordingRef ? "Recording saved for playback" : null,
  ].filter(Boolean);
  if (metaEl) metaEl.textContent = metaPieces.join(" · ");

  const mount = document.getElementById("uploadMediaMount");
  if (mount) {
    const rawRef = displayRecordingRef ? String(displayRecordingRef).trim() : "";
    const baseRef = rawRef.replace(/^.*[/\\\\]/, "").trim();

    if (baseRef.startsWith("rec_") && !baseRef.includes("..")) {
      const src = `/recordings/${encodeURIComponent(baseRef)}`;
      const typeStr = String(displayType || "").toLowerCase();
      const isVideo =
        typeStr === "video" || /\.(mp4|webm|mov|mpeg|mkv)$/i.test(baseRef);

      mount.innerHTML = isVideo
        ? `<video class="upload-playback-media" playsinline preload="metadata" src="${src}"></video>`
        : `<audio class="upload-playback-audio" preload="metadata" src="${src}"></audio>`;
      mount.className =
        `upload-media-mount upload-media-mount--has-media${isVideo ? "" : " upload-media-mount--audio-only"}`;
      const mediaEl = mount.querySelector("video, audio");
      if (mediaEl) {
        uploadViewPlaybackMedia = mediaEl;
        wireUploadViewTransport(mediaEl, { src, downloadName: baseRef || displayTitle });
      }
    } else {
      mount.className = "upload-media-mount";
      mount.innerHTML = `
        <div class="upload-media-ph">
          <span class="upload-media-ph-label">Playback</span>
          <p class="muted upload-media-ph-text">
            No saved media file for this session (e.g. created from Home capture without a stored file, or recorded before persistence was enabled).
          </p>
        </div>`;
    }
  }

  const raw = String(displayTranscript || "").trim();
  let coachAnalysisSnapshot = meeting?.analysis || upload?.analysis || null;
  let parts = [];
  if (raw) {
    let turnParts = [];
    if (typeof segmentTranscriptIntoSpeakerTurns === "function") {
      const turns = segmentTranscriptIntoSpeakerTurns(raw);
      if (turns.length)
        turnParts = turns.map((t) =>
          `${t.speakerLabel}: ${t.body}`.trim()
        );
    }
    if (turnParts.length) parts = turnParts;
    else parts = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }
  if (!parts.length) {
    parts = [
      "No transcript text is stored for this session yet.",
    ];
  }

  const flatStarts =
    (upload && upload.transcriptTokenStartsSec) ||
    (meeting && meeting.transcriptTokenStartsSec) ||
    null;

  let bodySlices =
    flatStarts && raw ? bodyWordStartSlicesForParts(parts, flatStarts, raw) : null;
  if (
    !bodySlices &&
    Array.isArray(flatStarts) &&
    flatStarts.length &&
    raw &&
    parts.length &&
    !/^No transcript text is stored/i.test(parts[0] || "")
  ) {
    const alt = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (alt.length) {
      const retry = bodyWordStartSlicesForParts(alt, flatStarts, raw);
      if (retry) {
        parts = alt;
        bodySlices = retry;
      }
    }
  }
  uploadViewBodyStartsSlicesSnapshot = bodySlices;

  const transcriptMissingPlaceholder = /^No transcript text is stored/i.test(parts[0] || "");
  uploadViewRawTranscriptSnapshot = transcriptMissingPlaceholder ? "" : raw;
  uploadViewFlatTokenStartsSnapshot =
    uploadViewRawTranscriptSnapshot &&
    Array.isArray(flatStarts) &&
    flatStarts.length
      ? flatStarts.slice()
      : null;

  const totalSec = Math.max(0, parseDurationLabelToSeconds(displayDuration) || 0);
  uploadViewDurationLabelSec = totalSec;
  uploadViewTranscriptPartsSnapshot = parts.slice();
  uploadViewTimelineSecSnapshot = totalSec;
  const linesHtml = buildInteractiveTranscriptLinesHtml(parts, totalSec, bodySlices);

  const linesRoot = document.getElementById("transcriptLines");
  if (linesRoot) linesRoot.innerHTML = linesHtml;

  if (uploadViewPlaybackMedia) syncUploadTranscriptTimelineToMedia(uploadViewPlaybackMedia);

  const search = document.getElementById("transcriptSearch");
  if (search) {
    search.value = "";
    search.oninput = () => {
      if (typeof window.applyUploadViewTranscriptLineFilter === "function") {
        window.applyUploadViewTranscriptLineFilter();
      } else {
        const q = search.value.trim().toLowerCase();
        document.querySelectorAll("#transcriptLines .transcript-line").forEach((row) => {
          const hay = row.innerText.toLowerCase();
          row.classList.toggle("hidden", Boolean(q) && !hay.includes(q));
        });
      }
    };
  }

  const insightLines = [];
  if (!transcriptMissingPlaceholder) {
    for (const p of parts) {
      const parsed = parseTranscriptTurnSpeaker(p);
      const body = String(parsed.body ?? "").replace(/^—$/, "").trim();
      const lineLower = `${parsed.speakerLabel}: ${body}`.trim().toLowerCase();
      insightLines.push({ speaker: parsed.speakerLabel, body, text: lineLower });
    }
  }
  if (typeof window.renderUploadSessionInsights === "function") {
    window.renderUploadSessionInsights({
      lines: insightLines,
      durationSec: totalSec,
      meetingKey: meetingIdParam || uploadIdParam || "session",
    });
  }

  const copyBtn = document.getElementById("uploadViewCopyBtn");
  if (copyBtn) {
    const fullCopy = raw || parts.join("\n\n");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(fullCopy);
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy all";
        }, 1400);
      } catch {
        copyBtn.textContent = "Could not copy";
        setTimeout(() => {
          copyBtn.textContent = "Copy all";
        }, 1400);
      }
    };
  }

  const coachCard = document.getElementById("uploadViewCoachCard");
  const coachMount = document.getElementById("uploadViewCoachMount");
  const coachFocusRow = document.getElementById("uploadViewCoachFocusRow");
  const coachFocusSelect = document.getElementById("uploadViewCoachFocusSelect");

  function getCoachFocusSpeakerForApi() {
    if (!coachFocusSelect || !coachFocusRow || coachFocusRow.classList.contains("hidden")) return "";
    const v = coachFocusSelect.value || "";
    return normalizeCoachFocusForSave(v);
  }

  const COACH_FOCUS_HINT_DEFAULT =
    "The summary and checklist update when you pick a speaker. “Ask coach” always uses the same selection.";

  function populateUploadViewCoachFocusSelect() {
    if (!coachFocusRow || !coachFocusSelect) return;
    const labels =
      typeof collectTranscriptSpeakerLabels === "function" ? collectTranscriptSpeakerLabels(raw) : [];

    coachFocusSelect.innerHTML = "";
    const oAll = document.createElement("option");
    oAll.value = "__all__";
    oAll.textContent = "Everyone (full transcript)";
    coachFocusSelect.appendChild(oAll);
    for (const lab of labels) {
      const o = document.createElement("option");
      o.value = lab;
      o.textContent = lab;
      coachFocusSelect.appendChild(o);
    }

    const hintEl = document.getElementById("uploadViewCoachFocusHint");
    if (!labels.length) {
      coachFocusRow.classList.add("hidden");
      if (hintEl) hintEl.classList.add("hidden");
      return;
    }

    coachFocusRow.classList.remove("hidden");
    if (hintEl) {
      hintEl.textContent = COACH_FOCUS_HINT_DEFAULT;
      hintEl.classList.remove("hidden");
    }

    let pick = "__all__";
    const saved = normalizeCoachFocusForSave(meeting?.coachFocusSpeaker ?? "");
    if (saved && labels.some((x) => x.toLowerCase() === saved.toLowerCase())) {
      pick = labels.find((x) => x.toLowerCase() === saved.toLowerCase()) || "__all__";
    } else if (!saved && meeting?.ownerLabel && typeof coachFocusFromHostHint === "function") {
      const hinted = coachFocusFromHostHint(raw, meeting.ownerLabel);
      if (hinted) pick = hinted;
    }
    coachFocusSelect.value = pick;
  }

  populateUploadViewCoachFocusSelect();

  const skillsGenBtnEl = document.getElementById("uploadViewSkillsGenerate");
  const coachGenerateStatusElId = "uploadViewCoachGenerateStatus";

  function renderCoachMainPanel() {
    if (!coachCard || !coachMount) return;
    const coachHtml = coachAnalysisSnapshot
      ? buildCoachAnalysisHTML(coachAnalysisSnapshot)
      : meeting?.summary
        ? `<div class="coach-block"><h3 class="subsection-title">Summary</h3><p class="coach-summary-text">${escapeHtml(
            meeting.summary
          )}</p></div>`
        : raw
          ? `<div class="coach-block">
              <h3 class="subsection-title">AI coach</h3>
              <p class="muted skills-empty-hint">No analysis yet for this transcript.</p>
              <button type="button" class="menu-action" id="uploadViewCoachGenerateBtn">Generate AI coach</button>
              <p id="${coachGenerateStatusElId}" class="grammar-reason skills-generate-status"></p>
            </div>`
          : `<div class="coach-block"><p class="muted skills-empty-hint">Transcript text is missing — AI coach needs a transcript.</p></div>`;

    coachMount.innerHTML = coachHtml;
    coachCard.classList.remove("hidden");
  }

  function renderSkillsTabPanel() {
    const mount = document.getElementById("uploadViewSkillsMount");
    const genBtn = document.getElementById("uploadViewSkillsGenerate");
    const st = document.getElementById("uploadViewSkillsStatus");
    if (st) st.textContent = "";
    if (!mount || !genBtn) return;
    if (!raw) {
      mount.innerHTML = `<p class="muted skills-empty-hint">Transcript text is missing — add words before generating skills.</p>`;
      genBtn.classList.add("hidden");
      return;
    }
    genBtn.classList.remove("hidden");
    if (coachAnalysisSnapshot) {
      const sk = buildSkillsPanelHTML(coachAnalysisSnapshot);
      mount.innerHTML = sk || `<p class="muted">No checklist items parsed from analysis.</p>`;
      genBtn.textContent = "Regenerate from transcript";
    } else {
      mount.innerHTML = `<p class="muted skills-empty-hint">Generate skill checklists (delivery, language, pronunciation) from this transcript.</p>`;
      genBtn.textContent = "Generate from transcript";
    }
  }

  renderCoachMainPanel();
  renderSkillsTabPanel();

  const tabButtons = document.querySelectorAll("[data-upload-tab]");
  const panelMap = {
    transcript: document.getElementById("uploadViewPanelTranscript"),
    analytics: document.getElementById("uploadViewPanelAnalytics"),
    coach: document.getElementById("uploadViewPanelCoach"),
    skills: document.getElementById("uploadViewPanelSkills"),
  };

  const analyticsTabBtn = document.querySelector('[data-upload-tab="analytics"]');
  if (analyticsTabBtn) {
    if (meetingIdParam) {
      analyticsTabBtn.classList.remove("hidden");
      analyticsTabBtn.removeAttribute("tabindex");
    } else {
      analyticsTabBtn.classList.add("hidden");
      analyticsTabBtn.setAttribute("tabindex", "-1");
    }
  }

  async function refreshUploadViewMeetingAnalytics() {
    if (!meetingIdParam) return;
    const errEl = document.getElementById("uploadViewAnalyticsError");
    const metaEl = document.getElementById("uploadViewAnalyticsMeta");
    if (errEl) errEl.textContent = "";
    try {
      const data = await fetchJson(
        `/api/dashboard/meetings/${encodeURIComponent(meetingIdParam)}/analytics`
      );
      fillAnalyticsDashboardWidgets(data, {
        grammar: "uploadViewKpiGrammar",
        pronunciation: "uploadViewKpiPronunciation",
        filler: "uploadViewKpiFillerWords",
        improvementBody: "uploadViewImprovementTableBody",
      });
      if (metaEl) {
        const parts = [];
        const mins = data.minutesScannedForFillers;
        if (typeof mins === "number" && mins > 0) {
          parts.push(`${mins} min of transcript used for filler rate`);
        }
        if (data.analyzedSessions > 0) {
          parts.push("Coach analysis included");
        } else if (data.grammarScore == null && data.pronunciationScore == null) {
          parts.push("Generate AI coach (AI skills tab) for grammar/pronunciation scores");
        }
        metaEl.textContent = parts.join(" · ");
      }
    } catch (e) {
      if (errEl) errEl.textContent = e.message || "Could not load session analytics.";
      if (metaEl) metaEl.textContent = "";
    }
  }

  function setUploadTab(name) {
    tabButtons.forEach((btn) => {
      const on = btn.dataset.uploadTab === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panelMap).forEach(([k, el]) => {
      if (el) el.classList.toggle("hidden", k !== name);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setUploadTab(btn.dataset.uploadTab));
  });
  setUploadTab("transcript");

  const coachMsgs = document.getElementById("uploadViewCoachMessages");
  const coachHint = document.getElementById("uploadViewCoachChatHint");
  if (coachMsgs) coachMsgs.innerHTML = "";
  if (coachHint) coachHint.classList.remove("hidden");

  const coachPurposeDefault =
    (meeting && String(meeting.purpose || "").trim()) ||
    (upload && String(upload.purpose || "").trim()) ||
    (meeting && String(meeting.title || "").trim().slice(0, 120)) ||
    String(displayTitle || "Recording").trim().slice(0, 120);
  const coachRoleDefault =
    (meeting && String(meeting.role || "").trim()) ||
    (upload && String(upload.role || "").trim()) ||
    "Meeting participant";

  const coachRoleStored = (meeting && String(meeting.role || "").trim()) || (upload && String(upload.role || "").trim()) || "";
  const coachPurposeStored =
    (meeting && String(meeting.purpose || "").trim()) || (upload && String(upload.purpose || "").trim()) || "";

  function getCoachContextRole() {
    const el = document.getElementById("uploadViewCoachRole");
    if (el && String(el.value ?? "").trim()) return String(el.value).trim().slice(0, 280);
    return coachRoleDefault;
  }

  function getCoachContextPurpose() {
    const el = document.getElementById("uploadViewCoachPurpose");
    if (el && String(el.value ?? "").trim()) return String(el.value).trim().slice(0, 280);
    return coachPurposeDefault;
  }

  const coachRoleEl = document.getElementById("uploadViewCoachRole");
  const coachPurposeEl = document.getElementById("uploadViewCoachPurpose");
  if (coachRoleEl) coachRoleEl.value = coachRoleStored;
  if (coachPurposeEl) coachPurposeEl.value = coachPurposeStored;

  let coachContextPersistTimer = null;
  function schedulePersistCoachAskContext() {
    if (!meetingIdParam || !meeting?.id || !coachRoleEl || !coachPurposeEl) return;
    if (coachContextPersistTimer) clearTimeout(coachContextPersistTimer);
    coachContextPersistTimer = setTimeout(async () => {
      coachContextPersistTimer = null;
      try {
        await fetchJson(`/api/dashboard/meetings/${encodeURIComponent(meeting.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: String(coachRoleEl.value || "").trim().slice(0, 280),
            purpose: String(coachPurposeEl.value || "").trim().slice(0, 280),
          }),
        });
      } catch {
        /* ignore */
      }
    }, 550);
  }
  coachRoleEl?.addEventListener("input", schedulePersistCoachAskContext);
  coachPurposeEl?.addEventListener("input", schedulePersistCoachAskContext);

  let coachAnalyzeInFlight = false;
  let coachFocusAnalyzeTimer = null;

  async function runUploadViewCoachAnalyze(opts = {}) {
    const { trigger = "skills" } = opts;
    const skillsStatusEl = document.getElementById("uploadViewSkillsStatus");
    const coachGenStatusEl = document.getElementById(coachGenerateStatusElId);
    const hintEl = document.getElementById("uploadViewCoachFocusHint");

    if (!raw) {
      if (trigger === "skills" && skillsStatusEl) skillsStatusEl.textContent = "Nothing to analyze.";
      return;
    }
    if (coachAnalyzeInFlight) return;
    coachAnalyzeInFlight = true;

    if (coachFocusSelect) coachFocusSelect.disabled = true;
    if (skillsGenBtnEl) skillsGenBtnEl.disabled = true;

    if (trigger === "focus" && hintEl && !coachFocusRow?.classList.contains("hidden")) {
      hintEl.textContent = "Updating coach for this speaker…";
    } else if (trigger === "skills" && skillsStatusEl) {
      skillsStatusEl.textContent = "Generating skill insights…";
      if (coachGenStatusEl) coachGenStatusEl.textContent = "Generating AI coach…";
    }

    if (errBox) errBox.textContent = "";

    try {
      const focus = getCoachFocusSpeakerForApi();
      const data = await fetchJson("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: raw,
          role: getCoachContextRole(),
          purpose: getCoachContextPurpose(),
          ...(focus ? { coachFocusSpeaker: focus } : {}),
        }),
      });
      coachAnalysisSnapshot = data;

      if (meetingIdParam && meeting?.id) {
        await fetchJson(`/api/dashboard/meetings/${encodeURIComponent(meeting.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: data,
            summary: data.summary || "",
            coachStatus: "completed",
            coachFocusSpeaker: getCoachFocusSpeakerForApi(),
            role: String(coachRoleEl?.value ?? "").trim().slice(0, 280),
            purpose: String(coachPurposeEl?.value ?? "").trim().slice(0, 280),
          }),
        });
        const mr = await fetchJson(`/api/dashboard/meetings/${encodeURIComponent(meetingIdParam)}`);
        meeting = mr.meeting;
        coachAnalysisSnapshot = meeting.analysis || data;
      } else if (uploadIdParam && upload?.id) {
        await fetchJson(`/api/dashboard/uploads/${encodeURIComponent(upload.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: data,
            summary: data.summary || "",
            coachStatus: "completed",
            coachFocusSpeaker: getCoachFocusSpeakerForApi(),
            role: String(coachRoleEl?.value ?? "").trim().slice(0, 280),
            purpose: String(coachPurposeEl?.value ?? "").trim().slice(0, 280),
          }),
        });
        const ur = await fetchJson(`/api/dashboard/uploads/${encodeURIComponent(upload.id)}`);
        upload = ur.upload;
        coachAnalysisSnapshot = upload.analysis || data;
      }

      renderCoachMainPanel();
      renderSkillsTabPanel();
      if (meetingIdParam) void refreshUploadViewMeetingAnalytics();

      if (trigger === "focus" && hintEl && !coachFocusRow?.classList.contains("hidden")) {
        hintEl.textContent = COACH_FOCUS_HINT_DEFAULT;
      }

      if (trigger === "skills" && skillsStatusEl) {
        skillsStatusEl.textContent = meetingIdParam
          ? "Saved with this meeting."
          : "Skills ready for this session.";
        if (coachGenStatusEl) {
          coachGenStatusEl.textContent = meetingIdParam
            ? "AI coach saved with this meeting."
            : "AI coach ready for this session.";
        }
        setTimeout(() => {
          if (
            skillsStatusEl.textContent === "Saved with this meeting." ||
            skillsStatusEl.textContent === "Skills ready for this session."
          ) {
            skillsStatusEl.textContent = "";
          }
          if (
            coachGenStatusEl &&
            (coachGenStatusEl.textContent === "AI coach saved with this meeting." ||
              coachGenStatusEl.textContent === "AI coach ready for this session.")
          ) {
            coachGenStatusEl.textContent = "";
          }
        }, 4000);
      }
    } catch (err) {
      const msg = err.message || "Analysis failed.";
      if (trigger === "focus" && hintEl && !coachFocusRow?.classList.contains("hidden")) {
        hintEl.textContent = msg;
        setTimeout(() => {
          if (hintEl.textContent === msg) hintEl.textContent = COACH_FOCUS_HINT_DEFAULT;
        }, 7000);
      }
      if (trigger === "skills" && skillsStatusEl) skillsStatusEl.textContent = msg;
      if (trigger === "skills" && coachGenStatusEl) coachGenStatusEl.textContent = msg;
      if (errBox) errBox.textContent = msg;
    } finally {
      coachAnalyzeInFlight = false;
      if (coachFocusSelect) coachFocusSelect.disabled = false;
      if (skillsGenBtnEl) skillsGenBtnEl.disabled = false;
    }
  }

  if (coachFocusSelect && coachFocusRow && !coachFocusRow.classList.contains("hidden")) {
    coachFocusSelect.addEventListener("change", () => {
      if (!raw) return;
      if (coachFocusAnalyzeTimer) clearTimeout(coachFocusAnalyzeTimer);
      coachFocusAnalyzeTimer = setTimeout(() => {
        coachFocusAnalyzeTimer = null;
        runUploadViewCoachAnalyze({ trigger: "focus" });
      }, 480);
    });
  }

  async function submitCoachQuestion(qText) {
    const question = String(qText || "").trim();
    const askStatus = document.getElementById("uploadViewCoachAskStatus");
    const sendBtn = document.getElementById("uploadViewCoachSend");
    const taEl = document.getElementById("uploadViewCoachQuestion");
    if (!question) return;
    if (!coachMsgs) {
      if (askStatus)
        askStatus.textContent =
          "Coach chat could not load. Refresh the page or open this recording from Meetings again.";
      return;
    }
    if (!raw) {
      if (askStatus) askStatus.textContent = "Transcript text is missing; nothing to analyze.";
      return;
    }

    coachMsgs.insertAdjacentHTML(
      "beforeend",
      `<div class="coach-chat-bubble coach-chat-bubble--user">${escapeHtml(question)}</div>`
    );
    if (coachHint) coachHint.classList.add("hidden");

    const coachBubbleId = `coach-reply-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    coachMsgs.insertAdjacentHTML(
      "beforeend",
      `<div id="${coachBubbleId}" class="coach-chat-bubble coach-chat-bubble--coach">…</div>`
    );

    const replyEl = document.getElementById(coachBubbleId);
    const scrollEl = document.getElementById("uploadViewCoachChatScroll");
    try {
      if (sendBtn) sendBtn.disabled = true;
      if (askStatus) askStatus.textContent = "";
      const focus = getCoachFocusSpeakerForApi();
      const data = await fetchJson("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: raw,
          question,
          role: getCoachContextRole(),
          purpose: getCoachContextPurpose(),
          ...(focus ? { coachFocusSpeaker: focus } : {}),
        }),
      });
      if (replyEl) replyEl.textContent = data.answer || "No answer.";
    } catch (e) {
      if (replyEl) replyEl.textContent = e.message || "Request failed.";
      if (askStatus) askStatus.textContent = e.message || "";
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (taEl) taEl.focus();
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }

  const sendBtn = document.getElementById("uploadViewCoachSend");
  const coachTa = document.getElementById("uploadViewCoachQuestion");
  if (sendBtn && coachTa) {
    sendBtn.addEventListener("click", async () => {
      await submitCoachQuestion(coachTa.value);
      coachTa.value = "";
    });
    coachTa.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitCoachQuestion(coachTa.value);
        coachTa.value = "";
      }
    });
  }

  const sugg = document.getElementById("uploadViewCoachSuggestions");
  if (sugg) {
    sugg.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-coach-q]");
      if (!chip || !chip.dataset.coachQ) return;
      const q = chip.dataset.coachQ.trim();
      submitCoachQuestion(q);
      if (coachTa) coachTa.value = "";
    });
  }

  if (skillsGenBtnEl) {
    skillsGenBtnEl.addEventListener("click", () => {
      runUploadViewCoachAnalyze({ trigger: "skills" });
    });
  }

  coachMount?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("#uploadViewCoachGenerateBtn");
    if (!btn) return;
    runUploadViewCoachAnalyze({ trigger: "skills" });
  });

  wireUploadViewCoachListen();

  if (meetingIdParam) void refreshUploadViewMeetingAnalytics();

  document.querySelectorAll(".sidebar .menu-item").forEach((link) => {
    const href = link.getAttribute("href") || "";
    link.classList.remove("active");
    if (meetingIdParam && href.includes("meetings.html")) link.classList.add("active");
    else if (uploadIdParam && href.includes("uploads.html")) link.classList.add("active");
  });
}

function buildImprovementAreaDetailHtml(areaLabel, fullData) {
  const label = String(areaLabel || "").toLowerCase();
  if (label.includes("not enough data")) {
    return `<p>Add meetings with transcripts and run <strong>AI coach</strong> to unlock grammar and pronunciation rows. Filler metrics need transcript text plus a parsable duration.</p>`;
  }
  if (label.includes("grammar")) {
    const n =
      fullData && fullData.analyzedSessions != null ? String(fullData.analyzedSessions) : "—";
    return `<p>Estimated from coach output: grammar suggestions versus transcript length (workspace heuristic).</p><p class="muted">Sessions with coach analysis in this view: ${escapeHtml(
      n
    )}.</p>`;
  }
  if (label.includes("pronunciation")) {
    return `<p>Estimated from coach-listed pronunciation issues and short feedback lines, weighted by transcript length.</p>`;
  }
  if (label.includes("conciseness") || label.includes("filler")) {
    const f = fullData && fullData.fillerWordsPerMinute;
    const m = fullData && fullData.minutesScannedForFillers;
    const parts = [
      `<p>Filler tokens are detected with a fixed word list (for example <em>um</em>, <em>like</em>, <em>yani</em>) over transcripts that include a duration.</p>`,
    ];
    if (f != null)
      parts.push(`<p class="muted">Observed filler rate: ${escapeHtml(String(f))} per minute.</p>`);
    if (typeof m === "number" && m > 0) {
      parts.push(
        `<p class="muted">Minutes used in the filler/min denominator: ${escapeHtml(String(m))}.</p>`
      );
    }
    parts.push(
      `<p class="muted">The “current” percentage is a concise score derived from filler rate, not a human judgment.</p>`
    );
    return parts.join("");
  }
  return `<p class="muted">Derived from stored coach analyses and transcripts for this view.</p>`;
}

function toggleImprovementTableRow(mainTr, tbody) {
  if (!mainTr || !tbody) return;
  const i = mainTr.getAttribute("data-improvement-toggle");
  const detail = tbody.querySelector(`tr[data-improvement-detail="${i}"]`);
  if (!detail) return;
  const opening = detail.classList.contains("hidden");
  detail.classList.toggle("hidden", !opening);
  const isOpen = !detail.classList.contains("hidden");
  mainTr.setAttribute("aria-expanded", isOpen ? "true" : "false");
  mainTr.classList.toggle("improvement-expandable--open", isOpen);
  const chev = mainTr.querySelector(".improvement-chevron");
  if (chev) chev.textContent = isOpen ? "▾" : "▸";
}

/**
 * @param {object} data
 * @param {{ grammar: string; pronunciation: string; filler: string; improvementBody: string }} ids
 */
function fillAnalyticsDashboardWidgets(data, ids) {
  if (!data || !ids) return;
  const gEl = document.getElementById(ids.grammar);
  const pEl = document.getElementById(ids.pronunciation);
  const fEl = document.getElementById(ids.filler);
  if (gEl) gEl.textContent = data.grammarScore == null ? "—" : `${data.grammarScore}%`;
  if (pEl) pEl.textContent = data.pronunciationScore == null ? "—" : `${data.pronunciationScore}%`;
  if (fEl)
    fEl.textContent = data.fillerWordsPerMinute == null ? "—" : String(data.fillerWordsPerMinute);
  const tbody = ids.improvementBody ? document.getElementById(ids.improvementBody) : null;
  if (tbody) {
    tbody.innerHTML = (data.improvementAreas || [])
      .map((a, i) => {
        const detailInner = buildImprovementAreaDetailHtml(a.area, data);
        return `
      <tr class="improvement-expandable" tabindex="0" role="button" aria-expanded="false" data-improvement-toggle="${i}">
        <td><span class="improvement-chevron" aria-hidden="true">▸</span> ${escapeHtml(a.area)}</td>
        <td>${escapeHtml(a.current)}</td>
        <td>${escapeHtml(a.target)}</td>
      </tr>
      <tr class="improvement-detail-row hidden" data-improvement-detail="${i}">
        <td colspan="3"><div class="improvement-detail-inner">${detailInner}</div></td>
      </tr>`;
      })
      .join("");

    tbody.onclick = (e) => {
      const tr = e.target.closest("tr.improvement-expandable");
      if (!tr || !tbody.contains(tr)) return;
      toggleImprovementTableRow(tr, tbody);
    };
    tbody.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const tr = e.target.closest("tr.improvement-expandable");
      if (!tr || !tbody.contains(tr)) return;
      e.preventDefault();
      toggleImprovementTableRow(tr, tbody);
    };
  }
}

async function loadAnalyticsPage() {
  const data = await fetchJson("/api/dashboard/analytics");
  fillAnalyticsDashboardWidgets(data, {
    grammar: "kpiGrammar",
    pronunciation: "kpiPronunciation",
    filler: "kpiFillerWords",
    improvementBody: "improvementTableBody",
  });
}

/** @type { unknown[] | null } */
let teamMembersCache = null;

/** @type { unknown[] | null } */
let teamGroupsCache = null;

function populateTeamInviteGroupSelectFromCache() {
  const sel = document.getElementById("teamInviteGroupSelect");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="">— None —</option>`;
  for (const g of Array.isArray(teamGroupsCache) ? teamGroupsCache : []) {
    if (!g?.id) continue;
    const o = document.createElement("option");
    o.value = String(g.id);
    o.textContent = String(g.name || g.id);
    sel.appendChild(o);
  }
  if (prev && [...sel.options].some((op) => op.value === prev)) sel.value = prev;
}

function updateTeamInviteStaticCopy() {
  const lead = document.getElementById("teamInviteLead");
  if (!lead) return;
  if (window.__teamLastSmtpConfigured) {
    lead.innerHTML =
      "An invitation email is sent via SMTP when <code>SMTP_HOST</code> is set. Invites always appear below on this page.";
  } else {
    lead.innerHTML =
      "<strong>No SMTP configured.</strong> Add <code>SMTP_HOST</code> (and user/pass) to <code>.env</code> to send mail. Until then invitations are saved in this workspace only.";
  }
}

function buildTeamGroupMemberChecks(selectedIds = []) {
  const box = document.getElementById("teamGroupMemberChecks");
  if (!box) return;
  const set = new Set((selectedIds || []).map(String));
  const members = Array.isArray(teamMembersCache) ? teamMembersCache : [];
  const eligible = members.filter((m) => {
    const st = String(m.status || "").toLowerCase();
    return st === "active" || st === "invited";
  });
  if (!eligible.length) {
    box.innerHTML = `<p class="muted" style="margin:0">Invite people by email on the Invite tab first, then add them here.</p>`;
    return;
  }
  box.innerHTML = eligible
    .map((m) => {
      const id = String(m.id || "").replace(/"/g, "");
      const checked = set.has(String(m.id)) ? " checked" : "";
      return `<label class="team-check-label">
        <input type="checkbox" value="${escapeHtml(id)}"${checked} />
        <span>${escapeHtml(m.name || "—")} <span class="muted">(${escapeHtml(m.email || "")})</span></span>
      </label>`;
    })
    .join("");
}

function renderTeamGroupsList() {
  const ul = document.getElementById("teamGroupsList");
  const empty = document.getElementById("teamGroupsEmpty");
  if (!ul) return;
  const rows = Array.isArray(teamGroupsCache) ? teamGroupsCache : [];
  const tabLbl = document.getElementById("teamTabGroupsLabel");
  const n = rows.length;
  if (tabLbl) tabLbl.textContent = `${n} group${n === 1 ? "" : "s"}`;

  if (!rows.length) {
    ul.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");

  ul.innerHTML = rows
    .map((g) => {
      const mem = Array.isArray(g.members) ? g.members : [];
      const snippet = mem
        .slice(0, 4)
        .map((x) => escapeHtml(String(x.name || x.email || "—")))
        .join(", ");
      const mc = typeof g.memberCount === "number" ? g.memberCount : mem.length;
      const overflowTxt = mc > 4 ? ` · +${mc - 4} more` : "";
      const desc =
        typeof g.description === "string" && g.description.trim()
          ? `<p class="muted team-group-card-desc">${escapeHtml(g.description.trim())}</p>`
          : "";
      const memberLine = snippet ? snippet : `<span class="muted">No members yet</span>`;
      return `
        <li class="team-group-card" data-group-id="${escapeHtml(String(g.id))}">
          <div class="team-group-card-body">
            <p class="team-group-card-title">${escapeHtml(String(g.name || "Untitled group"))}</p>
            ${desc}
            <div class="team-group-mini-members">${memberLine}<span class="muted">${escapeHtml(overflowTxt)}</span></div>
          </div>
          <div class="team-group-card-actions">
            <button type="button" class="ghost-btn team-group-mini-btn" data-group-edit="${escapeHtml(String(g.id))}">
              Edit
            </button>
            <button type="button" class="ghost-btn team-group-mini-btn team-group-mini-btn--danger" data-group-delete="${escapeHtml(
              String(g.id)
            )}">
              Delete
            </button>
          </div>
        </li>`;
    })
    .join("");
}

async function refreshTeamGroups() {
  const data = await fetchJson("/api/dashboard/groups");
  teamGroupsCache = Array.isArray(data.groups) ? data.groups : [];
  renderTeamGroupsList();
  populateTeamInviteGroupSelectFromCache();
}

function openTeamGroupModal(group) {
  const dlg = document.getElementById("teamGroupDialog");
  const idEl = document.getElementById("teamGroupEditingId");
  const titleEl = document.getElementById("teamGroupModalTitle");
  if (!dlg || !idEl || !titleEl) return;
  const isEdit = Boolean(group && group.id);
  idEl.value = isEdit ? String(group.id) : "";
  titleEl.textContent = isEdit ? "Edit group" : "New group";
  document.getElementById("teamGroupNameInput").value = group?.name ? String(group.name) : "";
  document.getElementById("teamGroupDescInput").value =
    typeof group?.description === "string" ? group.description : "";
  buildTeamGroupMemberChecks(isEdit ? group.memberIds || [] : []);
  dlg.showModal();
}

function ensureTeamHubControls() {
  if (window.__teamHubControlsWired) return;
  window.__teamHubControlsWired = true;

  document.getElementById("teamGroupDismissBtn")?.addEventListener("click", () => {
    document.getElementById("teamGroupDialog")?.close();
  });

  document.getElementById("teamInviteForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("teamInviteEmailInput");
    const groupSel = document.getElementById("teamInviteGroupSelect");
    const foot = document.getElementById("teamInviteFootnote");
    const email = String(emailInput?.value || "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) {
      if (foot) foot.textContent = "Enter a valid email address.";
      return;
    }
    const groupId = String(groupSel?.value || "").trim();
    try {
      const payload = /** @type { Record<string, string> } */ ({ email });
      if (groupId) payload.groupId = groupId;
      const res = await fetchJson("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (emailInput) emailInput.value = "";
      if (foot) foot.textContent = "";
      await showAppConfirm({
        title: "Invitation queued",
        message: res.mailHint || `Invitation saved for ${email}.`,
        confirmLabel: "OK",
      });
      await loadTeamPage();
    } catch (err) {
      await showAppConfirm({
        title: "Invite failed",
        message: err.message || "Could not send invitation.",
        confirmLabel: "OK",
      });
    }
  });

  document.getElementById("teamNewGroupBtn")?.addEventListener("click", () => {
    openTeamGroupModal(null);
  });

  document.getElementById("teamGroupForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editingId = document.getElementById("teamGroupEditingId")?.value?.trim() || "";
    const name = document.getElementById("teamGroupNameInput")?.value?.trim() || "";
    const description = document.getElementById("teamGroupDescInput")?.value?.trim() || "";
    const checked = [
      ...document.querySelectorAll("#teamGroupMemberChecks input[type='checkbox']:checked"),
    ].map((i) => i.value);
    const dlg = document.getElementById("teamGroupDialog");
    if (!name) {
      await showAppConfirm({ title: "Name required", message: "Enter a group name.", confirmLabel: "OK" });
      return;
    }
    try {
      if (editingId) {
        await fetchJson(`/api/dashboard/groups/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, memberIds: checked }),
        });
      } else {
        await fetchJson("/api/dashboard/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, memberIds: checked }),
        });
      }
      dlg?.close();
      await refreshTeamGroups();
      await loadTeamPage();
    } catch (err) {
      await showAppConfirm({
        title: "Could not save group",
        message: err.message || "Try again.",
        confirmLabel: "OK",
      });
    }
  });

  document.getElementById("teamGroupsList")?.addEventListener("click", async (ev) => {
    const del = ev.target.closest("[data-group-delete]");
    if (del) {
      const gid = del.getAttribute("data-group-delete");
      if (!gid) return;
      const ok = await showAppConfirm({
        title: "Delete group?",
        message: "Teammates stay on the roster; only the label is removed.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!ok) return;
      try {
        await fetchJson(`/api/dashboard/groups/${encodeURIComponent(gid)}`, { method: "DELETE" });
        await refreshTeamGroups();
        await loadTeamPage();
      } catch (err) {
        await showAppConfirm({ title: "Delete failed", message: err.message || "Error", confirmLabel: "OK" });
      }
      return;
    }
    const ed = ev.target.closest("[data-group-edit]");
    if (ed) {
      const gid = ed.getAttribute("data-group-edit");
      const grp = Array.isArray(teamGroupsCache) ? teamGroupsCache.find((x) => String(x.id) === String(gid)) : null;
      if (grp) openTeamGroupModal(grp);
    }
  });
}

function renderTeamInvitesPreview(invites, smtpOk) {
  const ul = document.getElementById("teamInvitesList");
  const head = document.getElementById("teamInvitesHeading");
  const list = Array.isArray(invites) ? [...invites] : [];
  if (!ul || !head) return;
  if (!list.length) {
    ul.innerHTML = "";
    ul.classList.add("hidden");
    head.hidden = true;
    return;
  }
  head.hidden = false;
  ul.classList.remove("hidden");
  ul.innerHTML = list
    .slice(0, 8)
    .map((inv) => {
      const mail = escapeHtml(inv.email || "—");
      const whenRaw = Date.parse(inv.createdAt || "");
      const when = Number.isFinite(whenRaw)
        ? new Date(whenRaw).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : "";
      const gLine = inv.groupId ? " · grouped invite" : "";
      const suffix = smtpOk ? `${gLine}${when ? ` · ${when}` : ""}` : ` · stored${gLine}${when ? ` · ${when}` : ""}`;
      return `<li>${mail}<span class="muted">${escapeHtml(suffix)}</span></li>`;
    })
    .join("");
}

async function loadTeamPage() {
  ensureTeamHubControls();

  const [teamData, invitesData] = await Promise.all([
    fetchJson("/api/dashboard/team"),
    fetchJson("/api/dashboard/invites"),
  ]);

  window.__teamLastSmtpConfigured = !!teamData.smtpConfigured;

  const members = Array.isArray(teamData.members) ? teamData.members : [];
  teamMembersCache = members;

  await refreshTeamGroups();

  renderTeamInvitesPreview(invitesData.invites || [], !!teamData.smtpConfigured);

  if (!window.__teamSubtabsWired) {
    window.__teamSubtabsWired = true;
    document.querySelectorAll("[data-team-sub]:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = btn.dataset.teamSub;
        document.querySelectorAll("[data-team-sub]:not(:disabled)").forEach((b) => {
          b.classList.toggle("team-pill-tab--active", b === btn);
        });
        const mates = document.getElementById("teamPanelTeammates");
        const groups = document.getElementById("teamPanelGroups");
        if (sub === "mates") {
          mates?.classList.remove("hidden");
          groups?.classList.add("hidden");
        }
        if (sub === "groups") {
          groups?.classList.remove("hidden");
          mates?.classList.add("hidden");
        }
      });
    });
  }

  updateTeamInviteStaticCopy();
}

let settingsPageInitialized = false;

function formatGoogleCalendarStart(isoOrDate) {
  if (!isoOrDate) return "—";
  const t = Date.parse(isoOrDate);
  if (!Number.isFinite(t)) return String(isoOrDate);
  return new Date(t).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildGoogleCalendarEventsRowsHtml(events) {
  const rows = Array.isArray(events) ? events : [];
  if (!rows.length) {
    return `<li class="muted">No upcoming events in the next 14 days.</li>`;
  }
  return rows
    .map((e) => {
      const meet = e.meetLink
        ? `<a href="${escapeHtml(e.meetLink)}" target="_blank" rel="noopener noreferrer">Join Meet</a>`
        : `<span class="muted">No Meet link</span>`;
      const cal = e.htmlLink
        ? `<a href="${escapeHtml(e.htmlLink)}" target="_blank" rel="noopener noreferrer">Open in Calendar</a>`
        : `<span class="muted">No calendar link</span>`;
      const start = escapeHtml(formatGoogleCalendarStart(e.start));
      return `<li class="google-cal-ev"><div><strong>${escapeHtml(e.summary)}</strong></div><div class="muted google-cal-ev-meta">${start}</div><div class="google-cal-ev-actions">${meet} · ${cal}</div></li>`;
    })
    .join("");
}

/** Settings → Integrations: connect / disconnect only (list lives on Meetings). */
async function refreshGoogleCalendarPanel() {
  const statusLine = document.getElementById("googleCalStatusLine");
  const connectBtn = document.getElementById("googleCalConnectBtn");
  const disconnectBtn = document.getElementById("googleCalDisconnectBtn");
  if (!statusLine || !connectBtn || !disconnectBtn) return;

  statusLine.textContent = "Loading calendar status…";

  try {
    const st = await fetchJson("/api/integrations/google/calendar/status");
    if (!st.configured) {
      statusLine.innerHTML = `Add <code>GOOGLE_CLIENT_SECRET</code> to <code>.env</code>. Callback URL: ${escapeHtml(
        st.redirectUri || ""
      )}`;
      connectBtn.hidden = true;
      disconnectBtn.hidden = true;
      return;
    }

    connectBtn.hidden = false;

    if (!st.connected) {
      statusLine.textContent =
        "Connect your account. Upcoming events and Meet links appear on the Meetings page after you connect.";
      disconnectBtn.hidden = true;
      return;
    }

    disconnectBtn.hidden = false;
    statusLine.textContent = st.email
      ? `Connected as ${st.email}. Open Meetings to see the next two weeks.`
      : "Connected. Open Meetings to see upcoming events.";
  } catch (err) {
    statusLine.textContent = err.message || "Calendar integration failed.";
    disconnectBtn.hidden = true;
    connectBtn.hidden = false;
  }
}

/** Meetings hub: list upcoming events + Meet links. */
async function refreshMeetingsGoogleCalendarSection() {
  const section = document.getElementById("meetingsGoogleCalSection");
  const statusEl = document.getElementById("meetingsGoogleCalStatus");
  const listEl = document.getElementById("meetingsGoogleCalList");
  const hintEl = document.getElementById("meetingsGoogleCalHint");
  const refreshBtn = document.getElementById("meetingsGoogleCalRefreshBtn");
  if (!section || !statusEl || !listEl || !hintEl || !refreshBtn) return;

  statusEl.textContent = "Checking calendar…";
  listEl.innerHTML = "";
  hintEl.textContent = "";
  hintEl.classList.add("hidden");
  refreshBtn.hidden = true;

  try {
    const st = await fetchJson("/api/integrations/google/calendar/status");
    if (!st.configured) {
      statusEl.textContent = "Calendar connection is not configured on this server.";
      hintEl.textContent = "Add GOOGLE_CLIENT_SECRET and redirect URI in .env (see .env.example), then connect in Settings.";
      hintEl.classList.remove("hidden");
      return;
    }
    if (!st.connected) {
      statusEl.textContent = "";
      hintEl.innerHTML = `<a href="/settings.html#settings-integrations">Connect Google Calendar in Settings</a> to see events and Meet links here.`;
      hintEl.classList.remove("hidden");
      return;
    }

    hintEl.classList.add("hidden");
    statusEl.textContent = st.email ? `Signed in · ${st.email}` : "Connected.";
    refreshBtn.hidden = false;

    const ev = await fetchJson("/api/integrations/google/calendar/events");
    if (ev.error) {
      listEl.innerHTML = `<li class="muted">${escapeHtml(ev.error)}</li>`;
      return;
    }
    listEl.innerHTML = buildGoogleCalendarEventsRowsHtml(ev.events || []);
  } catch (err) {
    statusEl.textContent = err.message || "Could not load calendar.";
    listEl.innerHTML = "";
  }
}

function syncCalendarScopeVisibility() {
  const cal = document.getElementById("calendarAutoRecord");
  const wrap = document.getElementById("calendarScopeWrap");
  if (!wrap) return;
  wrap.classList.toggle("hidden", !(cal && cal.checked));
}

async function loadSettingsPage() {
  const settings = await fetchJson("/api/dashboard/settings");

  async function refreshWorkspaceKeyLine() {
    try {
      const st = await fetchJson("/api/dashboard/workspace-api-key");
      const el = document.getElementById("workspaceApiKeyLine");
      if (el) el.textContent = st.masked ? `Current · ${st.masked}` : "—";
    } catch (e) {
      const el = document.getElementById("workspaceApiKeyLine");
      if (el) el.textContent = e.message || "Could not load key.";
    }
  }

  const setSwitch = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.checked = settingsEnabledToBool(settings[key]);
  };

  setSwitch("calendarAutoRecord", "calendarAutoRecord");
  setSwitch("captureMeetingVideo", "captureMeetingVideo");
  setSwitch("transcriptSpeakerSeparation", "transcriptSpeakerSeparation");
  setSwitch("autoTranscription", "autoTranscription");
  setSwitch("autoAnalysis", "autoAnalysis");
  setSwitch("publicGuestAccess", "publicGuestAccess");
  setSwitch("autoRequestPrivateAccess", "autoRequestPrivateAccess");
  setSwitch("recapEmailEnabled", "recapEmailEnabled");
  setSwitch("meetingPrepEmail", "meetingPrepEmail");
  setSwitch("weeklyProgress", "weeklyProgress");
  setSwitch("emailSummary", "emailSummary");
  setSwitch("browserNotifications", "browserNotifications");
  setSwitch("slackIntegrationAlerts", "slackIntegrationAlerts");

  const setSelect = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = settings[key];
    if (v == null || v === "") return;
    const match = [...el.options].find((o) => o.value === String(v));
    if (match) el.value = match.value;
  };

  setSelect("calendarRecordScope", "calendarRecordScope");
  setSelect("defaultLanguage", "defaultLanguage");
  setSelect("recordingQuality", "recordingQuality");
  setSelect("autoDeleteRetention", "autoDeleteRetention");
  setSelect("meetingPrivacyDefault", "meetingPrivacyDefault");
  setSelect("recapEmailRecipients", "recapEmailRecipients");
  setSelect("recapIncludeDetail", "recapIncludeDetail");

  const slackUrl = document.getElementById("slackWebhookUrl");
  if (slackUrl) slackUrl.value = settings.slackWebhookUrl || "";
  const recRules = document.getElementById("recordingRuleKeywords");
  if (recRules) recRules.value = settings.recordingRuleKeywords || "";
  const restRules = document.getElementById("restrictionRuleKeywords");
  if (restRules) restRules.value = settings.restrictionRuleKeywords || "";

  syncCalendarScopeVisibility();

  const form = document.getElementById("settingsForm");
  if (!form) return;

  if (!settingsPageInitialized) {
    settingsPageInitialized = true;
    document.getElementById("calendarAutoRecord")?.addEventListener("change", syncCalendarScopeVisibility);

    document.querySelectorAll(".settings-jump-link").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const href = a.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        ev.preventDefault();
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.getElementById("googleCalConnectBtn")?.addEventListener("click", async () => {
      try {
        const { url } = await fetchJson("/api/integrations/google/calendar/start");
        if (url) window.location.href = url;
      } catch (err) {
        await showAppConfirm({
          title: "Calendar",
          message: err.message || "Could not start Google authorization.",
          confirmLabel: "OK",
        });
      }
    });

    document.getElementById("googleCalDisconnectBtn")?.addEventListener("click", async () => {
      const ok = await showAppConfirm({
        title: "Disconnect Google?",
        message: "You can reconnect anytime from Integrations.",
        confirmLabel: "Disconnect",
      });
      if (!ok) return;
      await fetchJson("/api/integrations/google/calendar", { method: "DELETE" });
      await refreshGoogleCalendarPanel();
    });

    document.getElementById("workspaceApiRotateBtn")?.addEventListener("click", async () => {
      const ok = await showAppConfirm({
        title: "Rotate workspace API key?",
        message: "Copy the new key immediately. Anything using the old key will stop working.",
        confirmLabel: "Rotate",
      });
      if (!ok) return;
      try {
        const data = await fetchJson("/api/dashboard/workspace-api-key/rotate", { method: "POST" });
        await showAppConfirm({
          title: "New workspace key",
          message: data.key || "(empty)",
          confirmLabel: "OK",
        });
        await refreshWorkspaceKeyLine();
      } catch (e) {
        await showAppConfirm({
          title: "Rotate failed",
          message: e.message || "Error",
          confirmLabel: "OK",
        });
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        defaultLanguage: document.getElementById("defaultLanguage").value,
        calendarAutoRecord: settingsBoolToEnabled(document.getElementById("calendarAutoRecord").checked),
        calendarRecordScope: document.getElementById("calendarRecordScope").value,
        captureMeetingVideo: settingsBoolToEnabled(document.getElementById("captureMeetingVideo").checked),
        recordingQuality: document.getElementById("recordingQuality").value,
        autoDeleteRetention: document.getElementById("autoDeleteRetention").value,
        transcriptSpeakerSeparation: settingsBoolToEnabled(
          document.getElementById("transcriptSpeakerSeparation").checked
        ),
        autoTranscription: settingsBoolToEnabled(document.getElementById("autoTranscription").checked),
        autoAnalysis: settingsBoolToEnabled(document.getElementById("autoAnalysis").checked),
        meetingPrivacyDefault: document.getElementById("meetingPrivacyDefault").value,
        publicGuestAccess: settingsBoolToEnabled(document.getElementById("publicGuestAccess").checked),
        autoRequestPrivateAccess: settingsBoolToEnabled(
          document.getElementById("autoRequestPrivateAccess").checked
        ),
        recapEmailEnabled: settingsBoolToEnabled(document.getElementById("recapEmailEnabled").checked),
        recapEmailRecipients: document.getElementById("recapEmailRecipients").value,
        recapIncludeDetail: document.getElementById("recapIncludeDetail").value,
        meetingPrepEmail: settingsBoolToEnabled(document.getElementById("meetingPrepEmail").checked),
        weeklyProgress: settingsBoolToEnabled(document.getElementById("weeklyProgress").checked),
        emailSummary: settingsBoolToEnabled(document.getElementById("emailSummary").checked),
        browserNotifications: settingsBoolToEnabled(document.getElementById("browserNotifications").checked),
        slackIntegrationAlerts: settingsBoolToEnabled(document.getElementById("slackIntegrationAlerts").checked),
        slackWebhookUrl: document.getElementById("slackWebhookUrl")?.value?.trim() || "",
        recordingRuleKeywords: document.getElementById("recordingRuleKeywords")?.value || "",
        restrictionRuleKeywords: document.getElementById("restrictionRuleKeywords")?.value || "",
      };
      await fetchJson("/api/dashboard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const banner = document.getElementById("settingsSaved");
      if (banner) banner.textContent = "Settings saved.";
      setTimeout(() => {
        if (banner) banner.textContent = "";
      }, 2200);
    });
  }

  await refreshWorkspaceKeyLine();
  await refreshGoogleCalendarPanel();

  const hRaw = window.location.hash.slice(1);
  const banner = document.getElementById("settingsSaved");
  if (/google=connected/.test(hRaw) && banner) {
    banner.textContent = "Google Calendar connected.";
    setTimeout(() => {
      banner.textContent = "";
    }, 4000);
    history.replaceState(null, "", `${window.location.pathname}#settings-integrations`);
  } else if (/google=error/.test(hRaw) && banner) {
    banner.classList.add("settings-saved-banner--error");
    banner.textContent = "Google authorization failed — check .env and Cloud Console redirect URI.";
    setTimeout(() => {
      banner.textContent = "";
      banner.classList.remove("settings-saved-banner--error");
    }, 5000);
    history.replaceState(null, "", `${window.location.pathname}#settings-integrations`);
  }
}

async function initDashboardPage() {
  try {
    const page = document.body.dataset.page;
    if (page === "meetings") await loadMeetingsPage();
    if (page === "uploads") await loadUploadsPage();
    if (page === "upload-view") await loadUploadViewPage();
    if (page === "analytics") await loadAnalyticsPage();
    if (page === "team") await loadTeamPage();
    if (page === "settings") await loadSettingsPage();
  } catch (error) {
    const box = document.getElementById("pageError");
    if (box) box.textContent = `Error: ${error.message}`;
  }
}

initDashboardPage();
