module.exports = (() => {
  "use strict";

  const MAX_RETRIES = 2;
  const MAX_AUTO_WAIT_MS = 10 * 60 * 1000;
  const TEMPORARY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

  function headerValue(headers, name) {
    if (!headers) return "";
    if (typeof headers.get === "function") return String(headers.get(name) || "").trim();
    if (typeof headers === "object") {
      const key = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());
      return key ? String(headers[key]).trim() : "";
    }
    const match = String(headers).match(new RegExp("(?:^|\\r?\\n)" + name + "\\s*:\\s*([^\\r\\n]*)", "i"));
    return match ? match[1].trim() : "";
  }

  function retryAfterMilliseconds(headers, now) {
    const instruction = headerValue(headers, "retry-after");
    if (!instruction) return null;
    if (/^\d+$/.test(instruction)) return Math.min(Number.MAX_SAFE_INTEGER, Number(instruction) * 1000);
    if (!/^[A-Za-z]{3,9},?\s/.test(instruction) || !/\bGMT$/i.test(instruction)) return null;
    const retryDate = Date.parse(instruction);
    if (!Number.isFinite(retryDate)) return null;
    const serverDate = Date.parse(headerValue(headers, "date"));
    return Math.max(0, retryDate - (Number.isFinite(serverDate) ? serverDate : now));
  }

  /** Pure retry decision; no request, timer, storage or UI side effects. */
  function decide({ url, response, failure, attempt = 0, now = Date.now(), random = Math.random }) {
    const result = { retry: false, delayMs: 0, cooldownMs: 0, category: "permanent", reason: "" };
    if (!failure) return { ...result, category: "success" };
    if (response === "abort") return { ...result, category: "cancelled" };
    if (String(url || "").startsWith("blob:")) return { ...result, category: "temporary-data" };
    const status = Number(response && response.status) || 0;
    const networkFailure = response === "timeout" || response === "onerror" || !response || status === 0;
    if (!networkFailure && !TEMPORARY_STATUSES.has(status)) return result;
    const rateLimited = status === 429 || status === 503;
    const headerDelay = retryAfterMilliseconds(response && response.responseHeaders, now);
    const backoff = (rateLimited ? 1000 : 500) * Math.pow(2, Math.min(2, Math.max(0, attempt)));
    const minimumDelay = headerDelay === null ? backoff : headerDelay;
    const jitter = Math.min(Math.max(0, MAX_AUTO_WAIT_MS - minimumDelay), Math.floor(Math.max(0, Math.min(1, Number(random()) || 0)) * Math.min(250, minimumDelay * .25)));
    const delayMs = minimumDelay + jitter;
    const cooldownMs = rateLimited || headerDelay !== null ? delayMs : 0;
    if (minimumDelay > MAX_AUTO_WAIT_MS) return { ...result, cooldownMs, category: rateLimited ? "rate-limit" : "temporary", reason: `服务器要求等待约 ${Math.ceil(minimumDelay / 1000)} 秒，超出自动等待上限，请稍后手动重试` };
    return { retry: attempt < MAX_RETRIES, delayMs, cooldownMs, category: rateLimited ? "rate-limit" : "temporary", reason: "" };
  }

  function sleep(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(new Error("下载已取消"));
      let timer;
      const finish = error => {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new Error("下载已取消"));
      timer = setTimeout(() => finish(), Math.max(0, milliseconds));
      signal?.addEventListener?.("abort", abort, { once: true });
    });
  }

  return { decide, sleep, MAX_RETRIES, MAX_AUTO_WAIT_MS };
})();
