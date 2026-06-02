const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const processBtn = document.getElementById("processBtn");
const recordingStatus = document.getElementById("recordingStatus");
const recordingTimer = document.getElementById("recordingTimer");
const processStatus = document.getElementById("processStatus");
const audioPreview = document.getElementById("audioPreview");
const previewPlayer = document.getElementById("previewPlayer");
const previewPlayBtn = document.getElementById("previewPlayBtn");
const previewMuteBtn = document.getElementById("previewMuteBtn");
const previewVolume = document.getElementById("previewVolume");
const pronunciationEl = document.getElementById("pronunciationFeedback");
const inviteBtn = document.getElementById("inviteBtn");
const downloadBtn = document.getElementById("downloadBtn");
const calendarSettingsBtn = document.getElementById("calendarSettingsBtn");
const meetingLanguageBtn = document.getElementById("meetingLanguageBtn");
const actionModalBackdrop = document.getElementById("actionModalBackdrop");
const actionModalTitle = document.getElementById("actionModalTitle");
const actionModalDescription = document.getElementById("actionModalDescription");
const actionModalInputLabel = document.getElementById("actionModalInputLabel");
const actionModalInput = document.getElementById("actionModalInput");
const actionModalStatus = document.getElementById("actionModalStatus");
const actionModalCancel = document.getElementById("actionModalCancel");
const actionModalSubmit = document.getElementById("actionModalSubmit");

let mediaRecorder;
let audioChunks = [];
let recordedBlob = null;
let activeTracks = [];
let currentModalAction = null;
let timerInterval = null;
let recordingStartMs = 0;

function guessCoachTtsLang(text) {
  const s = String(text ?? "");
  if (/[ğĞüÜşŞıİöÖçÇ]/.test(s)) return "tr-TR";
  if (/[ñÑáéíóúüÁÉÍÓÚÜ¿¡]/.test(s)) return "es-ES";
  if (/[äöüßÄÖÜ]/.test(s)) return "de-DE";
  if (/[àâçéèêëîïôùûüÿœæ]/.test(s)) return "fr-FR";
  return "en-US";
}

function speakCoachPhrase(text, variant = "suggested") {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !("speechSynthesis" in window)) return Promise.resolve(false);
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(trimmed);
  utter.lang = guessCoachTtsLang(trimmed);
  utter.pitch = 1;
  utter.rate = variant === "spoken" ? 0.94 : 0.8;
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

function openActionModal({ title, description, inputLabel, submitText, action }) {
  if (!actionModalBackdrop) return;
  currentModalAction = action;
  actionModalTitle.textContent = title;
  actionModalDescription.textContent = description;
  actionModalInputLabel.textContent = inputLabel;
  actionModalSubmit.textContent = submitText;
  actionModalInput.value = "";
  actionModalStatus.textContent = "";
  const scheduleWrap = document.getElementById("actionModalScheduleWrap");
  const scheduleAt = document.getElementById("actionModalScheduleAt");
  if (scheduleWrap) scheduleWrap.classList.toggle("hidden", action !== "schedule");
  if (scheduleAt) scheduleAt.value = "";
  actionModalBackdrop.classList.remove("hidden");
  setTimeout(() => actionModalInput.focus(), 0);
}

function closeActionModal() {
  if (!actionModalBackdrop) return;
  actionModalBackdrop.classList.add("hidden");
  currentModalAction = null;
}

function openScheduleMeetingModal() {
  openActionModal({
    title: "Schedule Meeting",
    description: "Create a new scheduled meeting.",
    inputLabel: "Meeting title",
    submitText: "Schedule",
    action: "schedule",
  });
}

function syncHomeCaptureNavExpanded() {
  const nav = document.getElementById("homeCaptureNavBtn");
  const dd = document.getElementById("capture");
  if (nav && dd) nav.setAttribute("aria-expanded", dd.open ? "true" : "false");
}

function openHomeCaptureMenu(options = {}) {
  const dd = document.getElementById("capture");
  if (!dd) return;
  dd.open = true;
  const scroll = options.scroll !== false;
  if (scroll) dd.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => {
    syncHomeCaptureNavExpanded();
    document.getElementById("role")?.focus({ preventScroll: options.preventScroll });
  }, 180);
}

document.getElementById("capture")?.addEventListener("toggle", syncHomeCaptureNavExpanded);
document.getElementById("homeCaptureNavBtn")?.addEventListener("click", () => openHomeCaptureMenu({ scroll: true }));
syncHomeCaptureNavExpanded();

function applyHomeUrlHashHooks() {
  const path = window.location.pathname || "";
  const onHome = path === "/" || path.endsWith("/index.html");
  if (!onHome) return;
  const chunk = window.location.hash.replace(/^#/, "").split("&")[0];
  if (!chunk) return;
  const cleanUrl = `${path}${window.location.search || ""}`;
  if (chunk === "capture") {
    openHomeCaptureMenu({ scroll: true });
    history.replaceState(null, "", cleanUrl);
  }
  if (chunk === "schedule") {
    openScheduleMeetingModal();
    history.replaceState(null, "", cleanUrl);
  }
}

function apiAuthHeaders() {
  return typeof window.meetinglyAuthHeaders === "function" ? window.meetinglyAuthHeaders() : {};
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startRecordingTimer() {
  recordingStartMs = Date.now();
  if (recordingTimer) recordingTimer.textContent = "00:00";
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - recordingStartMs) / 1000);
    if (recordingTimer) recordingTimer.textContent = formatDuration(elapsedSeconds);
  }, 1000);
}

function stopRecordingTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function readBlobDuration(blob) {
  return new Promise((resolve) => {
    const media = document.createElement("video");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      URL.revokeObjectURL(media.src);
      resolve(formatDuration(duration));
    };
    media.onerror = () => resolve("00:00");
    media.src = URL.createObjectURL(blob);
  });
}

function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

async function createRecordingStream() {
  // First try: tab/screen + system audio.
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch (err) {
    // Fallback: screen only.
    const screenOnly = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    // Optional microphone audio fallback if system/tab audio is not available.
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mixed = new MediaStream([...screenOnly.getVideoTracks(), ...mic.getAudioTracks()]);
      activeTracks = [...screenOnly.getTracks(), ...mic.getTracks()];
      return mixed;
    } catch {
      return screenOnly;
    }
  }
}

startBtn.addEventListener("click", async () => {
  try {
    audioChunks = [];
    recordedBlob = null;
    processBtn.disabled = true;
    if (audioPreview) {
      audioPreview.pause();
      audioPreview.currentTime = 0;
    }
    if (previewPlayer) previewPlayer.classList.add("hidden");
    window.speechSynthesis.cancel();

    const stream = await createRecordingStream();
    activeTracks = stream.getTracks();

    const stopOnTrackEnd = () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        try {
          mediaRecorder.stop();
        } catch {
          /* ignore */
        }
      }
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (recordingStatus) {
        recordingStatus.textContent = "Screen share ended — finalizing recording…";
      }
    };
    stream.getTracks().forEach((t) => t.addEventListener("ended", stopOnTrackEnd));

    const mimeType = getSupportedMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stopRecordingTimer();
      const blobType = mediaRecorder.mimeType || "video/webm";
      recordedBlob = new Blob(audioChunks, { type: blobType });
      const audioUrl = URL.createObjectURL(recordedBlob);
      audioPreview.src = audioUrl;
      audioPreview.classList.remove("hidden");
      if (previewPlayer) previewPlayer.classList.remove("hidden");
      if (previewPlayBtn) previewPlayBtn.textContent = "Play";
      if (previewMuteBtn) previewMuteBtn.textContent = "Mute";
      processBtn.disabled = false;

      activeTracks.forEach((track) => track.stop());
      recordingStatus.textContent = "Recording completed.";
    };

    mediaRecorder.start();
    startRecordingTimer();
    recordingStatus.textContent =
      "Recording... (For Meet audio, select Chrome tab and enable 'Share tab audio')";
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    stopRecordingTimer();
    if (recordingTimer) recordingTimer.textContent = "00:00";
    recordingStatus.textContent = `Recording error: ${error.message}. Allow screen/audio permissions and try again.`;
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

document.getElementById("homeCaptureMeetBtn")?.addEventListener("click", () => {
  window.open("https://meet.google.com/new", "_blank");
});
document.getElementById("homeCaptureScheduleBtn")?.addEventListener("click", () => openScheduleMeetingModal());
document.getElementById("homeCaptureUploadBtn")?.addEventListener("click", () => {
  window.location.href = "/uploads.html";
});
if (inviteBtn) {
  inviteBtn.addEventListener("click", () => {
    openActionModal({
      title: "Invite Teammate",
      description: "Send a workspace invitation by email.",
      inputLabel: "Email address",
      submitText: "Send Invite",
      action: "invite",
    });
  });
}
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    window.open("https://www.google.com/chrome/", "_blank");
  });
}
if (calendarSettingsBtn) {
  calendarSettingsBtn.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });
}
if (meetingLanguageBtn) {
  meetingLanguageBtn.addEventListener("click", () => {
    alert("Meeting language is set to English (Global).");
  });
}

if (actionModalCancel) {
  actionModalCancel.addEventListener("click", closeActionModal);
}

if (actionModalBackdrop) {
  actionModalBackdrop.addEventListener("click", (e) => {
    if (e.target === actionModalBackdrop) closeActionModal();
  });
}

if (actionModalSubmit) {
  actionModalSubmit.addEventListener("click", async () => {
    const value = actionModalInput.value.trim();
    if (!value) {
      actionModalStatus.textContent = "Please enter a value.";
      return;
    }
    actionModalSubmit.disabled = true;
    try {
      if (currentModalAction === "invite") {
        const res = await fetch("/api/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...apiAuthHeaders() },
          body: JSON.stringify({ email: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invite failed.");
        actionModalStatus.textContent = `Invite sent to ${data.invite.email}.`;
      } else if (currentModalAction === "schedule") {
        const scheduleAtEl = document.getElementById("actionModalScheduleAt");
        let scheduledFor = undefined;
        if (scheduleAtEl && scheduleAtEl.value) {
          const d = new Date(scheduleAtEl.value);
          if (Number.isFinite(d.getTime())) scheduledFor = d.toISOString();
        }
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: value,
            ...(scheduledFor ? { scheduledFor } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Schedule failed.");
        actionModalStatus.textContent = `Meeting scheduled: ${data.schedule.title}`;
        await loadUpcomingMeetingsPanel();
      }
      setTimeout(closeActionModal, 700);
    } catch (error) {
      actionModalStatus.textContent = error.message;
    } finally {
      actionModalSubmit.disabled = false;
    }
  });
}

processBtn.addEventListener("click", async () => {
  let createdMeetingId = null;
  try {
    const hostName = document.getElementById("captureHostName")?.value?.trim() || "";
    const role = document.getElementById("role").value.trim();
    const purpose = document.getElementById("purpose").value.trim();

    if (!recordedBlob) {
      alert("Please record first.");
      return;
    }

    processStatus.textContent = "Transcribing and saving to meetings…";
    processBtn.disabled = true;

    const formData = new FormData();
    formData.append("audio", recordedBlob, "meeting-audio.webm");
    if (hostName) formData.append("hostName", hostName);
    if (role) formData.append("role", role);
    if (purpose) formData.append("purpose", purpose);

    const transcribeRes = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    const transcribeData = await transcribeRes.json();

    if (!transcribeRes.ok) {
      throw new Error(
        transcribeData.details
          ? `${transcribeData.error || "Transcription request failed."} ${transcribeData.details}`
          : transcribeData.error || "Transcription request failed."
      );
    }

    const duration = await readBlobDuration(recordedBlob);
    const now = new Date();
    const hintedFocus =
      typeof coachFocusFromHostHint === "function"
        ? coachFocusFromHostHint(transcribeData.transcript, hostName)
        : null;

    const createMeetingRes = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Quick Capture - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        date: now.toLocaleString(),
        recordedAt: now.toISOString(),
        duration,
        transcriptStatus: "ready",
        coachStatus: "pending",
        role,
        purpose,
        transcript: transcribeData.transcript,
        ownerLabel: hostName || "You",
        ...(transcribeData.recordingRef ? { recordingRef: transcribeData.recordingRef } : {}),
        ...(Array.isArray(transcribeData.transcriptTokenStartsSec) &&
        transcribeData.transcriptTokenStartsSec.length
          ? { transcriptTokenStartsSec: transcribeData.transcriptTokenStartsSec }
          : {}),
        ...(hintedFocus ? { coachFocusSpeaker: hintedFocus } : {}),
      }),
    });
    const createMeetingData = await createMeetingRes.json();
    if (!createMeetingRes.ok) {
      throw new Error(createMeetingData.error || "Could not save meeting.");
    }
    createdMeetingId = createMeetingData.meeting?.id || null;
    if (!createdMeetingId) {
      throw new Error("Meeting was not assigned an id.");
    }

    processStatus.textContent = "Opening your session…";
    window.location.assign(
      `/upload-view.html?meetingId=${encodeURIComponent(createdMeetingId)}`
    );
  } catch (error) {
    if (createdMeetingId) {
      await fetch(`/api/meetings/${createdMeetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachStatus: "failed" }),
      });
    }
    processStatus.textContent = `Error: ${error.message}`;
  } finally {
    processBtn.disabled = false;
  }
});

pronunciationEl.addEventListener("click", async (event) => {
  const button = event.target.closest(".coach-tts-btn[data-tts]");
  if (!button) return;

  let text = "";
  try {
    text = decodeURIComponent(button.getAttribute("data-tts") || "");
  } catch {
    return;
  }
  const trimmed = String(text).trim();
  if (!trimmed) return;

  if (!("speechSynthesis" in window)) {
    alert("This browser doesn’t support read-aloud (Web Speech API).");
    return;
  }

  const variant = button.getAttribute("data-tts-variant") === "spoken" ? "spoken" : "suggested";
  const busySpoken = "Playing original…";
  const busySuggested = "Playing suggestion…";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.origLabel ||= button.innerHTML;
  const isChip = button.classList.contains("coach-tts-chip");
  button.innerHTML = isChip
    ? `<span class="coach-tts-chip-glyph" aria-hidden="true">▶</span>${escapeHtml(variant === "spoken" ? busySpoken : busySuggested)}`
    : `<span class="coach-tts-glyph" aria-hidden="true">…</span>` +
      (variant === "spoken" ? ` Playing original…` : ` Playing suggestion…`);

  await speakCoachPhrase(trimmed, variant);

  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.innerHTML = button.dataset.origLabel || button.innerHTML;
});

if (previewPlayBtn && audioPreview) {
  previewPlayBtn.addEventListener("click", () => {
    if (!audioPreview.src) return;
    if (audioPreview.paused) {
      audioPreview.play();
      previewPlayBtn.textContent = "Pause";
    } else {
      audioPreview.pause();
      previewPlayBtn.textContent = "Play";
    }
  });

  audioPreview.addEventListener("ended", () => {
    previewPlayBtn.textContent = "Play";
  });
}

if (previewMuteBtn && audioPreview) {
  previewMuteBtn.addEventListener("click", () => {
    audioPreview.muted = !audioPreview.muted;
    previewMuteBtn.textContent = audioPreview.muted ? "Unmute" : "Mute";
  });
}

if (previewVolume && audioPreview) {
  previewVolume.addEventListener("input", () => {
    audioPreview.volume = Number(previewVolume.value);
    if (audioPreview.volume === 0) {
      audioPreview.muted = true;
      if (previewMuteBtn) previewMuteBtn.textContent = "Unmute";
    } else if (audioPreview.muted) {
      audioPreview.muted = false;
      if (previewMuteBtn) previewMuteBtn.textContent = "Mute";
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let homeMeetingsCache = null;

async function fetchMeetingsForHomeSearch() {
  if (homeMeetingsCache) return homeMeetingsCache;
  const res = await fetch("/api/dashboard/meetings");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load meetings.");
  homeMeetingsCache = Array.isArray(data.meetings) ? data.meetings : [];
  return homeMeetingsCache;
}

function meetingHaystackForHome(m) {
  const asum =
    m.analysis && typeof m.analysis.summary === "string" ? m.analysis.summary : "";
  return `${m.title ?? ""} ${m.ownerLabel ?? ""} ${m.date ?? ""} ${m.transcript ?? ""} ${m.summary ?? ""} ${asum}`.toLowerCase();
}

function filterMeetingsForHomeQuery(meetings, q) {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  return meetings.filter((m) => meetingHaystackForHome(m).includes(ql));
}

function formatHomeMeetingSubtitle(m) {
  const owner = ((m.ownerLabel && String(m.ownerLabel).trim()) || "You").trim();
  const dur = m.duration || "—";
  const t = Date.parse(m.recordedAt || "");
  if (Number.isFinite(t)) {
    const d = new Date(t);
    const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const tim = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} · ${tim} · ${dur} · ${owner}`;
  }
  return `${String(m.date || "—")} · ${dur} · ${owner}`;
}

function renderHomeSearchResults(meetings, q) {
  const panel = document.getElementById("homeSearchResults");
  const list = document.getElementById("homeSearchResultsList");
  const empty = document.getElementById("homeSearchEmpty");
  const seeAll = document.getElementById("homeSearchSeeAll");
  if (!panel || !list || !empty) return;

  const ql = q.trim();
  if (!ql) {
    panel.classList.add("hidden");
    list.innerHTML = "";
    empty.classList.add("hidden");
    if (seeAll) seeAll.href = "/meetings.html";
    return;
  }

  if (seeAll) seeAll.href = `/meetings.html?q=${encodeURIComponent(ql)}`;

  const hits = filterMeetingsForHomeQuery(meetings, ql).slice(0, 8);

  if (!hits.length) {
    panel.classList.remove("hidden");
    list.innerHTML = "";
    empty.textContent = "No meetings match that search.";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  panel.classList.remove("hidden");
  list.innerHTML = hits
    .map((m) => {
      const mid = m.id ? encodeURIComponent(String(m.id)) : "";
      const title = escapeHtml(m.title || "Untitled");
      const sub = escapeHtml(formatHomeMeetingSubtitle(m));
      if (!mid) {
        return `<li class="home-search-hit home-search-hit--disabled"><span class="home-search-hit-title">${title}</span><span class="muted home-search-hit-meta">${sub}</span></li>`;
      }
      return `<li><a class="home-search-hit" href="/upload-view.html?meetingId=${mid}"><span class="home-search-hit-title">${title}</span><span class="muted home-search-hit-meta">${sub}</span></a></li>`;
    })
    .join("");
}

function formatScheduleSubtitle(s) {
  if (s.scheduledFor) {
    const t = Date.parse(s.scheduledFor);
    if (Number.isFinite(t)) {
      return new Date(t).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  const c = Date.parse(s.createdAt);
  if (Number.isFinite(c)) {
    return `Added ${new Date(c).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · no time set`;
  }
  return "No time set";
}

function renderScheduleRowHtml(s) {
  const id = encodeURIComponent(s.id);
  const title = escapeHtml(s.title || "Untitled");
  const sub = escapeHtml(formatScheduleSubtitle(s));
  return `<li class="upcoming-meeting-row">
    <div class="upcoming-meeting-body">
      <div class="upcoming-meeting-title">${title}</div>
      <div class="muted upcoming-meeting-meta">${sub}</div>
    </div>
    <button type="button" class="upcoming-meeting-remove" data-schedule-id="${id}" aria-label="Remove schedule">×</button>
  </li>`;
}

async function loadUpcomingMeetingsPanel() {
  const statusEl = document.getElementById("upcomingMeetingsStatus");
  const listEl = document.getElementById("upcomingMeetingsList");
  if (!statusEl || !listEl) return;
  statusEl.textContent = "Loading…";
  statusEl.classList.remove("hidden");
  listEl.classList.add("hidden");
  try {
    const res = await fetch("/api/schedules");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load schedules.");
    const schedules = Array.isArray(data.schedules) ? data.schedules : [];
    if (!schedules.length) {
      statusEl.textContent =
        "No scheduled meetings yet. Use Schedule below or Quick Start → Schedule.";
      listEl.innerHTML = "";
      return;
    }
    statusEl.classList.add("hidden");
    listEl.classList.remove("hidden");
    listEl.innerHTML = schedules.map(renderScheduleRowHtml).join("");
  } catch (e) {
    statusEl.textContent = e.message || "Could not load schedules.";
    statusEl.classList.remove("hidden");
    listEl.innerHTML = "";
  }
}

document.getElementById("upcomingMeetingsMount")?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".upcoming-meeting-remove");
  if (!btn) return;
  e.preventDefault();
  const id = btn.getAttribute("data-schedule-id");
  if (!id) return;
  try {
    const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) throw new Error(data.error || "Could not remove.");
    await loadUpcomingMeetingsPanel();
  } catch (err) {
    alert(err.message);
  }
});

loadUpcomingMeetingsPanel();

const homeSearchInput = document.getElementById("homeGlobalSearch");
if (homeSearchInput) {
  const runSearch = async () => {
    const q = homeSearchInput.value;
    try {
      const all = await fetchMeetingsForHomeSearch();
      renderHomeSearchResults(all, q);
    } catch (err) {
      const panel = document.getElementById("homeSearchResults");
      const list = document.getElementById("homeSearchResultsList");
      const empty = document.getElementById("homeSearchEmpty");
      if (panel && list && empty) {
        panel.classList.remove("hidden");
        list.innerHTML = "";
        empty.textContent = err.message || "Search failed.";
        empty.classList.remove("hidden");
      }
    }
  };

  const debouncedSearch = debounce(runSearch, 220);
  homeSearchInput.addEventListener("input", debouncedSearch);
  homeSearchInput.addEventListener("focus", () => {
    if (homeSearchInput.value.trim()) debouncedSearch();
  });
  homeSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = homeSearchInput.value.trim();
      if (q) window.location.href = `/meetings.html?q=${encodeURIComponent(q)}`;
    }
  });
}

const homeNotifBtn = document.getElementById("homeNotifBtn");
const homeNotifPopover = document.getElementById("homeNotifPopover");
const homeNotifList = document.getElementById("homeNotifList");
const homeNotifEmpty = document.getElementById("homeNotifEmpty");
const homeNotifClose = document.getElementById("homeNotifClose");

const HOME_NOTIF_DISMISSED_KEY = "meetinglyDismissedHomeNotifs";
const HOME_NOTIF_DISMISSED_CAP = 500;

function legacyLocalDismissedSet() {
  try {
    const raw = localStorage.getItem(HOME_NOTIF_DISMISSED_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

async function readHomeNotificationDismissedSet() {
  try {
    const res = await fetch("/api/dashboard/notification-dismissals", {
      headers: { ...apiAuthHeaders() },
    });
    if (res.ok) {
      const data = await res.json();
      const server = new Set((data.ids || []).map(String));
      legacyLocalDismissedSet().forEach((id) => server.add(id));
      return server;
    }
  } catch {
    /* ignore */
  }
  return legacyLocalDismissedSet();
}

async function dismissHomeNotification(nid) {
  if (!nid) return;
  try {
    const res = await fetch("/api/dashboard/notification-dismissals", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiAuthHeaders() },
      body: JSON.stringify({ dismiss: [String(nid)] }),
    });
    if (!res.ok) throw new Error("dismiss_failed");
    return;
  } catch {
    /* fallback */
  }
  const set = legacyLocalDismissedSet();
  set.add(String(nid));
  localStorage.setItem(HOME_NOTIF_DISMISSED_KEY, JSON.stringify([...set].slice(-HOME_NOTIF_DISMISSED_CAP)));
}

async function clearDismissedHomeNotifications() {
  try {
    const res = await fetch("/api/dashboard/notification-dismissals/reset", {
      method: "POST",
      headers: { ...apiAuthHeaders() },
    });
    if (!res.ok) throw new Error("reset_failed");
  } catch {
    /* fallback */
  }
  try {
    localStorage.removeItem(HOME_NOTIF_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

function setHomeNotifOpen(open) {
  if (!homeNotifPopover || !homeNotifBtn) return;
  homeNotifPopover.classList.toggle("hidden", !open);
  homeNotifBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

async function loadAndRenderHomeNotifications() {
  if (!homeNotifList || !homeNotifEmpty) return;
  homeNotifList.innerHTML = "";
  homeNotifEmpty.textContent = "You’re all caught up.";
  const items = [];
  try {
    const [meetingsRes, invitesRes] = await Promise.all([
      fetch("/api/dashboard/meetings"),
      fetch("/api/dashboard/invites"),
    ]);
    const md = await meetingsRes.json().catch(() => ({}));
    const iv = await invitesRes.json().catch(() => ({}));
    if (!meetingsRes.ok) throw new Error(md.error || "Could not load meetings.");
    if (!invitesRes.ok) throw new Error(iv.error || "Could not load invites.");
    const meetings = Array.isArray(md.meetings) ? md.meetings : [];
    const invites = Array.isArray(iv.invites) ? iv.invites : [];

    meetings.forEach((m) => {
      const rawId = m.id != null ? String(m.id).trim() : "";
      const mid = rawId ? encodeURIComponent(rawId) : "";
      const title = m.title || "Untitled";
      const href = rawId ? `/upload-view.html?meetingId=${mid}` : "/meetings.html";
      const ts = String(m.transcriptStatus || "").toLowerCase();
      const cs = String(m.coachStatus || "").toLowerCase();
      if (!rawId) return;
      if (ts === "processing") {
        items.push({
          nid: `m:${rawId}:processing`,
          href,
          title,
          meta: "Transcript is processing.",
        });
      } else if (ts === "ready" && cs === "pending") {
        items.push({
          nid: `m:${rawId}:coach_pending`,
          href,
          title,
          meta: "AI coaching is running.",
        });
      } else if (cs === "needs_review") {
        items.push({
          nid: `m:${rawId}:needs_review`,
          href,
          title,
          meta: "Suggested: review coach output.",
        });
      }
    });

    invites.slice(0, 8).forEach((inv) => {
      const invKey = inv.id != null ? String(inv.id).trim() : "";
      if (!invKey) return;
      const em = inv.email || "";
      const t = Date.parse(inv.createdAt || "");
      const when = Number.isFinite(t)
        ? new Date(t).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "";
      items.push({
        nid: `i:${invKey}`,
        href: "/team.html",
        title: em ? `Teammate invite · ${em}` : "Teammate invite",
        meta: when ? `Queued · ${when}` : "Queued for your workspace.",
      });
    });
  } catch (err) {
    homeNotifEmpty.textContent = err.message || "Could not load notifications.";
    homeNotifEmpty.classList.remove("hidden");
    return;
  }

  const dismissed = await readHomeNotificationDismissedSet();
  const visible = items.filter((it) => it.nid && !dismissed.has(String(it.nid))).slice(0, 16);

  if (!visible.length) {
    homeNotifEmpty.classList.remove("hidden");
    return;
  }

  homeNotifEmpty.classList.add("hidden");
  homeNotifList.innerHTML = visible
    .map(
      (it) => `<li class="home-notif-li">
      <a class="home-notif-li-link" href="${escapeHtml(it.href)}">
        <div class="home-notif-item-text">
          <span class="home-notif-item-title">${escapeHtml(it.title)}</span>
          <span class="home-notif-item-meta">${escapeHtml(it.meta)}</span>
        </div>
      </a>
      <button type="button" class="home-notif-dismiss" data-dismiss-id="${escapeHtml(it.nid)}" aria-label="Dismiss" title="Remove from list">×</button>
    </li>`
    )
    .join("");
}

if (homeNotifBtn && homeNotifPopover) {
  homeNotifBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const willOpen = homeNotifPopover.classList.contains("hidden");
    if (willOpen) await loadAndRenderHomeNotifications();
    setHomeNotifOpen(willOpen);
  });
}

homeNotifClose?.addEventListener("click", () => setHomeNotifOpen(false));

document.getElementById("homeNotifResetDismissed")?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  clearDismissedHomeNotifications();
  await loadAndRenderHomeNotifications();
});

if (homeNotifList && !homeNotifList.dataset.dismissDelegated) {
  homeNotifList.dataset.dismissDelegated = "1";
  homeNotifList.addEventListener("click", async (ev) => {
    const dismissBtn = ev.target.closest(".home-notif-dismiss");
    if (!dismissBtn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const nid = dismissBtn.getAttribute("data-dismiss-id");
    await dismissHomeNotification(nid);
    await loadAndRenderHomeNotifications();
  });
}

document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".app-nav-notif-wrap");
  if (!wrap || !homeNotifPopover || homeNotifPopover.classList.contains("hidden")) return;
  if (wrap.contains(e.target)) return;
  setHomeNotifOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !homeNotifPopover || homeNotifPopover.classList.contains("hidden")) return;
  setHomeNotifOpen(false);
});

window.addEventListener("focus", () => {
  homeMeetingsCache = null;
});

document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
  const path = window.location.pathname;
  const onHome = path === "/" || path.endsWith("/index.html");
  if (!onHome) return;
  const inp = document.getElementById("homeGlobalSearch");
  if (!inp) return;
  e.preventDefault();
  inp.focus();
});

function initHomeOverviewCard() {
  const card = document.getElementById("homeOverviewCard");
  const restoreWrap = document.getElementById("homeOverviewRestoreWrap");
  const restoreBtn = document.getElementById("homeOverviewRestoreBtn");

  function applyDismissState() {
    const dismissed = localStorage.getItem("meetinglyHomeOverviewDismissed") === "1";
    if (card) card.classList.toggle("hidden", dismissed);
    restoreWrap?.classList.toggle("hidden", !dismissed);
  }

  applyDismissState();

  restoreBtn?.addEventListener("click", () => {
    localStorage.removeItem("meetinglyHomeOverviewDismissed");
    applyDismissState();
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  if (!card) return;

  document.getElementById("homeOverviewHit")?.addEventListener("click", () => {
    openHomeCaptureMenu({ scroll: true });
  });

  card.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-overview-action]");
    if (!btn || !card.contains(btn)) return;
    const act = btn.getAttribute("data-overview-action");
    e.preventDefault();
    btn.closest("details")?.removeAttribute("open");

    switch (act) {
      case "capture":
        openHomeCaptureMenu({ scroll: true });
        break;
      case "meetings":
        window.location.href = "/meetings.html";
        break;
      case "uploads":
        window.location.href = "/uploads.html";
        break;
      case "analytics":
        window.location.href = "/analytics.html";
        break;
      case "dismiss":
        localStorage.setItem("meetinglyHomeOverviewDismissed", "1");
        applyDismissState();
        break;
      default:
        break;
    }
  });

  document.addEventListener("click", (e) => {
    if (!card.classList.contains("hidden") && e.target.closest(".overview-card-dd")) return;
    card.querySelectorAll(".overview-card-dd[open]").forEach((d) => d.removeAttribute("open"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (card.classList.contains("hidden")) return;
    card.querySelectorAll(".overview-card-dd[open]").forEach((d) => d.removeAttribute("open"));
  });
}

applyHomeUrlHashHooks();
initHomeOverviewCard();
