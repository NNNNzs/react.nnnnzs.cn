export const DEFAULT_POLL_JITTER_RATIO = 0.2;

export function applyPollJitter(
  delayMs: number,
  ratio = DEFAULT_POLL_JITTER_RATIO,
  random = Math.random,
) {
  if (delayMs <= 0 || ratio <= 0) return Math.max(0, delayMs);
  const boundedRatio = Math.min(1, ratio);
  const factor = 1 - boundedRatio + random() * boundedRatio * 2;
  return Math.max(0, Math.round(delayMs * factor));
}

export function getPollBackoffDelay(
  baseDelayMs: number,
  failures: number,
  maxDelayMs: number,
) {
  if (failures <= 0) return Math.min(baseDelayMs, maxDelayMs);
  return Math.min(baseDelayMs * (2 ** (failures - 1)), maxDelayMs);
}
