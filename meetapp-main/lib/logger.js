const LEVELS = { info: 1, warn: 2, error: 3 };

function emit(level, msg, meta) {
  const line =
    typeof meta === "object" && meta !== null ? { t: new Date().toISOString(), level, msg, ...meta } : { t: new Date().toISOString(), level, msg };
  const text = JSON.stringify(line);
  if (LEVELS[level] >= LEVELS.error) console.error(text);
  else if (LEVELS[level] >= LEVELS.warn) console.warn(text);
  else console.log(text);
}

module.exports = {
  logInfo: (msg, meta) => emit("info", msg, meta),
  logWarn: (msg, meta) => emit("warn", msg, meta),
  logError: (msg, meta) => emit("error", msg, meta),
};
