/**
 * @typedef {Object} Logger
 * @property {function(string, ...any): void} debug
 * @property {function(string, ...any): void} info
 * @property {function(string, ...any): void} warn
 * @property {function(string, ...any): void} error
 */

/**
 * Creates a console-based logger.
 *
 * @param {"debug" | "info" | "warn" | "error"} [minLevel="info"]
 * @returns {Logger}
 */
const createConsoleLogger = (minLevel = "info") => {
  const levels = ["debug", "info", "warn", "error"]
  const minIdx = levels.indexOf(minLevel)

  const shouldLog = (level) => levels.indexOf(level) >= minIdx

  return {
    debug: (msg, ...meta) =>
      shouldLog("debug") && console.debug(`[DEBUG] ${msg}`, ...meta),
    info: (msg, ...meta) =>
      shouldLog("info") && console.info(`[INFO] ${msg}`, ...meta),
    warn: (msg, ...meta) =>
      shouldLog("warn") && console.warn(`[WARN] ${msg}`, ...meta),
    error: (msg, ...meta) =>
      shouldLog("error") && console.error(`[ERROR] ${msg}`, ...meta),
  }
}

module.exports = {
  createConsoleLogger,
}
