const CHANNEL_NAME = 'ai-job-notifications';
const LOCK_RETRY_MS = 4000;
const LEASE_DURATION_MS = 12000;
const LEASE_REFRESH_MS = 5000;

export type TaskNotificationCoordinatorMessage =
  | { kind: 'snapshot'; userId: number; activeCount: number; cursor: string }
  | { kind: 'consumed'; userId: number; eventId: string };

interface LeaseRecord {
  ownerId: string;
  expiresAt: number;
}
interface CoordinatorCallbacks {
  onLeaderChange: (isLeader: boolean) => void;
  onMessage: (message: TaskNotificationCoordinatorMessage) => void;
}

export class TaskNotificationCoordinator {
  private readonly ownerId = crypto.randomUUID();
  private readonly lockName: string;
  private readonly leaseKey: string;
  private readonly messageKey: string;
  private channel: BroadcastChannel | null = null;
  private timer: number | null = null;
  private lockAbortController: AbortController | null = null;
  private lockRequestPending = false;
  private stopped = true;
  private isLeader = false;

  constructor(
    private readonly userId: number,
    private readonly callbacks: CoordinatorCallbacks,
  ) {
    this.lockName = `ai-task-notification-leader:${userId}`;
    this.leaseKey = `ai-task-notification-lease:${userId}`;
    this.messageKey = `ai-task-notification-message:${userId}`;
  }

  start() {
    if (typeof window === 'undefined' || !this.stopped) return;
    this.stopped = false;
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<TaskNotificationCoordinatorMessage>) => {
        this.handleMessage(event.data);
      };
    }
    window.addEventListener('storage', this.handleStorage);

    if ('locks' in navigator) {
      this.tryAcquireWebLock();
      this.timer = window.setInterval(() => this.tryAcquireWebLock(), LOCK_RETRY_MS);
    } else {
      this.refreshLease();
      this.timer = window.setInterval(() => this.refreshLease(), LEASE_REFRESH_MS);
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.lockAbortController?.abort();
    this.lockAbortController = null;
    this.lockRequestPending = false;
    this.channel?.close();
    this.channel = null;
    window.removeEventListener('storage', this.handleStorage);
    this.releaseLease();
    this.setLeader(false);
  }

  broadcast(message: TaskNotificationCoordinatorMessage) {
    this.channel?.postMessage(message);
    try {
      window.localStorage.setItem(this.messageKey, JSON.stringify({
        message,
        nonce: crypto.randomUUID(),
      }));
    } catch {
      // BroadcastChannel 可用时 storage 仅是降级通道。
    }
  }

  private setLeader(next: boolean) {
    if (this.isLeader === next) return;
    this.isLeader = next;
    this.callbacks.onLeaderChange(next);
  }

  private tryAcquireWebLock() {
    if (this.stopped || this.isLeader || this.lockRequestPending) return;
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
          if (abortController.signal.aborted) {
            resolve();
            return;
          }
          abortController.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        this.setLeader(false);
      },
    ).catch(() => {
      this.lockRequestPending = false;
      if (!this.stopped) this.refreshLease();
    });
  }

  private refreshLease() {
    if (this.stopped) return;
    const now = Date.now();
    let current: LeaseRecord | null = null;
    try {
      current = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as LeaseRecord | null;
    } catch {
      current = null;
    }

    if (!current || current.ownerId === this.ownerId || current.expiresAt <= now) {
      const lease = { ownerId: this.ownerId, expiresAt: now + LEASE_DURATION_MS };
      window.localStorage.setItem(this.leaseKey, JSON.stringify(lease));
      const confirmed = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as LeaseRecord | null;
      this.setLeader(confirmed?.ownerId === this.ownerId);
      return;
    }
    this.setLeader(false);
  }

  private releaseLease() {
    try {
      const current = JSON.parse(window.localStorage.getItem(this.leaseKey) || 'null') as LeaseRecord | null;
      if (current?.ownerId === this.ownerId) window.localStorage.removeItem(this.leaseKey);
    } catch {
      // 无法读取租约时交给过期机制恢复。
    }
  }

  private handleMessage(message: TaskNotificationCoordinatorMessage) {
    if (message?.userId === this.userId) this.callbacks.onMessage(message);
  }

  private handleStorage = (event: StorageEvent) => {
    if (event.key !== this.messageKey || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as { message?: TaskNotificationCoordinatorMessage };
      if (payload.message) this.handleMessage(payload.message);
    } catch {
      // 忽略其他标签页写入的无效消息。
    }
  };
}
