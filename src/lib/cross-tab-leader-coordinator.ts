const LOCK_RETRY_MS = 4000;
const LEASE_DURATION_MS = 12000;
const LEASE_REFRESH_MS = 5000;
const LATEST_MESSAGE_MAX_AGE_MS = 5 * 60 * 1000;

export interface CrossTabLeaseRecord {
  ownerId: string;
  expiresAt: number;
}

export function canAcquireCrossTabLease(
  current: CrossTabLeaseRecord | null,
  ownerId: string,
  now: number,
) {
  return !current || current.ownerId === ownerId || current.expiresAt <= now;
}

interface CrossTabLeaderCallbacks<TMessage> {
  onLeaderChange: (isLeader: boolean) => void;
  onMessage: (message: TMessage) => void;
}

interface CrossTabLeaderOptions {
  yieldWhenHidden?: boolean;
}

export class CrossTabLeaderCoordinator<TMessage> {
  private readonly ownerId = crypto.randomUUID();
  private readonly lockName: string;
  private readonly leaseKey: string;
  private readonly messageKey: string;
  private readonly channelName: string;
  private channel: BroadcastChannel | null = null;
  private timer: number | null = null;
  private lockAbortController: AbortController | null = null;
  private lockRequestPending = false;
  private usingLeaseFallback = false;
  private stopped = true;
  private isLeader = false;

  constructor(
    namespace: string,
    private readonly callbacks: CrossTabLeaderCallbacks<TMessage>,
    private readonly options: CrossTabLeaderOptions = {},
  ) {
    this.channelName = `cross-tab:${namespace}`;
    this.lockName = `cross-tab-leader:${namespace}`;
    this.leaseKey = `cross-tab-lease:${namespace}`;
    this.messageKey = `cross-tab-message:${namespace}`;
  }

  start() {
    if (typeof window === 'undefined' || !this.stopped) return;
    this.stopped = false;
    this.usingLeaseFallback = false;
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event: MessageEvent<TMessage>) => this.callbacks.onMessage(event.data);
    }
    window.addEventListener('storage', this.handleStorage);
    if (this.options.yieldWhenHidden) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.readLatestMessage();

    if ('locks' in navigator) {
      this.tryAcquireWebLock();
      this.timer = window.setInterval(() => this.tryAcquireWebLock(), LOCK_RETRY_MS);
    } else {
      this.startLeaseFallback();
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.lockAbortController?.abort();
    this.lockAbortController = null;
    this.lockRequestPending = false;
    this.channel?.close();
    this.channel = null;
    window.removeEventListener('storage', this.handleStorage);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.releaseLease();
    this.setLeader(false);
  }

  broadcast(message: TMessage) {
    this.channel?.postMessage(message);
    try {
      window.localStorage.setItem(this.messageKey, JSON.stringify({
        message,
        nonce: crypto.randomUUID(),
        sentAt: Date.now(),
      }));
    } catch {
      // BroadcastChannel 可用时 storage 仅作为降级通道。
    }
  }

  private setLeader(next: boolean) {
    if (this.isLeader === next) return;
    this.isLeader = next;
    this.callbacks.onLeaderChange(next);
  }

  private tryAcquireWebLock() {
    if (this.stopped || this.shouldYield() || this.isLeader || this.lockRequestPending) return;
    this.lockRequestPending = true;
    const abortController = new AbortController();
    this.lockAbortController = abortController;

    void navigator.locks.request(
      this.lockName,
      { mode: 'exclusive', ifAvailable: true, signal: abortController.signal },
      async (lock) => {
        this.lockRequestPending = false;
        if (!lock || this.stopped) return;
        this.setLeader(true);
        await new Promise<void>((resolve) => {
          if (abortController.signal.aborted) return resolve();
          abortController.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        this.setLeader(false);
      },
    ).catch((error: unknown) => {
      this.lockRequestPending = false;
      if (
        !this.stopped &&
        !(error instanceof Error && error.name === 'AbortError')
      ) {
        this.startLeaseFallback();
      }
    });
  }

  private startLeaseFallback() {
    if (this.stopped || this.usingLeaseFallback) return;
    this.usingLeaseFallback = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.refreshLease();
    this.timer = window.setInterval(() => this.refreshLease(), LEASE_REFRESH_MS);
  }

  private refreshLease() {
    if (this.stopped || this.shouldYield()) return;
    const now = Date.now();
    let current: CrossTabLeaseRecord | null = null;
    try {
      current = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as CrossTabLeaseRecord | null;
    } catch {
      current = null;
    }

    if (canAcquireCrossTabLease(current, this.ownerId, now)) {
      try {
        const lease = { ownerId: this.ownerId, expiresAt: now + LEASE_DURATION_MS };
        window.localStorage.setItem(this.leaseKey, JSON.stringify(lease));
        const confirmed = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as CrossTabLeaseRecord | null;
        this.setLeader(confirmed?.ownerId === this.ownerId);
      } catch {
        // 存储不可用时退化为每个标签页各自工作，确保功能不中断。
        this.setLeader(true);
      }
      return;
    }
    this.setLeader(false);
  }

  private releaseLease() {
    try {
      const current = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as CrossTabLeaseRecord | null;
      if (current?.ownerId === this.ownerId) window.localStorage.removeItem(this.leaseKey);
    } catch {
      // 租约会自然过期。
    }
  }

  private handleStorage = (event: StorageEvent) => {
    if (this.channel) return;
    if (event.key !== this.messageKey || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as { message?: TMessage };
      if (payload.message !== undefined) this.callbacks.onMessage(payload.message);
    } catch {
      // 忽略无效的跨标签页消息。
    }
  };

  private readLatestMessage() {
    try {
      const payload = JSON.parse(window.localStorage.getItem(this.messageKey) || 'null') as {
        message?: TMessage;
        sentAt?: number;
      } | null;
      if (
        payload?.message !== undefined &&
        typeof payload.sentAt === 'number' &&
        Date.now() - payload.sentAt <= LATEST_MESSAGE_MAX_AGE_MS
      ) {
        this.callbacks.onMessage(payload.message);
      }
    } catch {
      // 没有可恢复的最新快照。
    }
  }

  private shouldYield() {
    return Boolean(this.options.yieldWhenHidden && document.hidden);
  }

  private handleVisibilityChange = () => {
    if (!this.options.yieldWhenHidden || this.stopped) return;
    if (document.hidden) {
      this.lockAbortController?.abort();
      this.releaseLease();
      this.setLeader(false);
      return;
    }
    if ('locks' in navigator && !this.usingLeaseFallback) this.tryAcquireWebLock();
    else this.refreshLease();
  };
}
