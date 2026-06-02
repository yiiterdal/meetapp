const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

/** May be null on unsupported platforms until install script runs. */
const ffmpegPath = require("ffmpeg-static");
let ffprobePath;
try {
  ffprobePath = require("ffprobe-static").path;
} catch {
  ffprobePath = null;
}

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function probeDurationSec(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const raw = parseFloat(data?.format?.duration);
      resolve(Number.isFinite(raw) ? raw : 0);
    });
  });
}

function transcodeNarrowMp3(inputPath, outPath, bitrateKbps) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate(`${bitrateKbps}k`)
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outPath);
  });
}

function extractSegmentMp3(inputPath, outPath, startSec, durationSec, bitrateKbps) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(Math.max(0, startSec))
      .duration(Math.max(0.5, durationSec))
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate(`${bitrateKbps}k`)
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outPath);
  });
}

function isAvailable() {
  return Boolean(ffmpegPath && ffprobePath);
}

/**
 * If upload exceeds OpenAI's per-request cap, shrink (mono spoken-audio mp3), then slice in time-based chunks under maxBytes each.
 *
 * Caller always deletes original upload path; dispose() deletes any extra intermediates produced here.
 *
 * @param {string} inputPath Absolute path from multer disk storage
 * @param {string} uploadDir Writable temp folder
 * @param {number} maxBytes Conservative max size per Whisper/API request (stay under vendor hard cap)
 * @returns {Promise<{ paths: string[]; chunkOffsetsSec: number[]; dispose: () => void }>}
 */
async function prepareForOpenAiTranscription(inputPath, uploadDir, maxBytes) {
  const extras = [];
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const p of extras) safeUnlink(p);
  };

  const stat0 = fs.statSync(inputPath);
  if (stat0.size <= maxBytes) {
    return { paths: [inputPath], chunkOffsetsSec: [0], dispose };
  }

  if (!isAvailable()) {
    throw new Error(
      "Large file requires FFmpeg and ffprobe. Not available on this system — use a trimmed file under ~25 MB, or install FFmpeg in PATH and deploy with ffmpeg-static/ffprobe-static support."
    );
  }

  const rates = [64, 48, 32];
  let narrowPath;

  try {
    for (const rate of rates) {
      narrowPath = path.join(uploadDir, `prep_${rate}k_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`);
      await transcodeNarrowMp3(inputPath, narrowPath, rate);
      extras.push(narrowPath);

      if (fs.statSync(narrowPath).size <= maxBytes) {
        return { paths: [narrowPath], chunkOffsetsSec: [0], dispose };
      }
    }

    const encoded = narrowPath;
    const size = fs.statSync(encoded).size;
    const duration = await probeDurationSec(encoded);
    if (!Number.isFinite(duration) || duration < 0.2) {
      throw new Error("Could not read audio duration after FFmpeg processing. The file may have no audio track.");
    }

    let nChunks = Math.max(2, Math.ceil(size / maxBytes));
    nChunks = Math.min(nChunks, 500);

    const parts = [];
    const chunkOffsetsSec = [];

    for (let i = 0; i < nChunks; i++) {
      const start = (duration * i) / nChunks;
      let segmentLen = duration / nChunks;
      if (i === nChunks - 1) {
        segmentLen = Math.max(0.5, duration - start);
      }

      const outPath = path.join(
        uploadDir,
        `part_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}.mp3`
      );
      await extractSegmentMp3(encoded, outPath, start, segmentLen, 32);

      extras.push(outPath);

      const chunkSize = fs.statSync(outPath).size;
      if (chunkSize > maxBytes) {
        throw new Error(
          `A segment stayed above ${Math.round(maxBytes / (1024 * 1024))} MB after preprocessing. Trim the source or shorten the recording.`
        );
      }

      parts.push(outPath);
      chunkOffsetsSec.push(start);
    }

    return { paths: parts, chunkOffsetsSec, dispose };
  } catch (err) {
    dispose();
    throw err;
  }
}

module.exports = {
  prepareForOpenAiTranscription,
  isTranscriptionPrepAvailable: isAvailable,
};
