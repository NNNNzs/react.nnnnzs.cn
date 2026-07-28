'use client';

import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import { applyPollJitter, getPollBackoffDelay } from '@/lib/polling';

export interface AdaptivePollingContext {
  signal: AbortSignal;
  failures: number;
}

export interface AdaptivePollingOptions {
  enabled: boolean;
  poll: (context: AdaptivePollingContext) => Promise<number | null | void>;
  initialDelayMs?: number;
  initialJitterMaxMs?: number;
  pauseWhenHidden?: boolean;
  refreshOnVisible?: boolean;
  jitterRatio?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  onError?: (error: unknown) => void;
}

export interface AdaptivePollingController {
  runNow: () => void;
}

export function useAdaptivePolling({
  enabled,
  poll,
  initialDelayMs = 0,
  initialJitterMaxMs = 0,
  pauseWhenHidden = true,
  refreshOnVisible = true,
  jitterRatio = 0.2,
  backoffBaseMs = 15_000,
  maxBackoffMs = 300_000,
  onError,
}: AdaptivePollingOptions): AdaptivePollingController {
  const runNowRef = useRef<() => void>(() => {});
  const pollEvent = useEffectEvent(poll);
  const onErrorEvent = useEffectEvent((error: unknown) => onError?.(error));

  useEffect(() => {
    if (!enabled) {
      runNowRef.current = () => {};
      return;
    }

    let stopped = false;
    let running = false;
    let pendingRun = false;
    let failures = 0;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = (delayMs: number, jitter = true) => {
      if (stopped) return;
      clearTimer();
      const delay = jitter ? applyPollJitter(delayMs, jitterRatio) : Math.max(0, delayMs);
      timer = window.setTimeout(() => void execute(), delay);
    };

    const execute = async () => {
      if (stopped || running) return;
      if (pauseWhenHidden && document.hidden) return;

      running = true;
      controller = new AbortController();
      try {
        const nextDelayMs = await pollEvent({ signal: controller.signal, failures });
        if (stopped) return;
        failures = 0;
        if (typeof nextDelayMs === 'number') schedule(nextDelayMs);
      } catch (error) {
        if (stopped || (error instanceof Error && error.name === 'AbortError')) return;
        failures += 1;
        onErrorEvent(error);
        schedule(getPollBackoffDelay(backoffBaseMs, failures, maxBackoffMs));
      } finally {
        running = false;
        controller = null;
        if (!stopped && pendingRun) {
          pendingRun = false;
          schedule(0, false);
        }
      }
    };

    const runNow = () => {
      if (stopped) return;
      if (running) {
        pendingRun = true;
        return;
      }
      schedule(0, false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pauseWhenHidden) {
          clearTimer();
          controller?.abort();
        }
        return;
      }
      if (refreshOnVisible) runNow();
    };

    runNowRef.current = runNow;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const firstDelay = initialJitterMaxMs > 0
      ? initialDelayMs + Math.round(Math.random() * initialJitterMaxMs)
      : initialDelayMs;
    schedule(firstDelay, false);

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      runNowRef.current = () => {};
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    backoffBaseMs,
    enabled,
    initialDelayMs,
    initialJitterMaxMs,
    jitterRatio,
    maxBackoffMs,
    pauseWhenHidden,
    refreshOnVisible,
  ]);

  return {
    runNow: useCallback(() => runNowRef.current(), []),
  };
}
