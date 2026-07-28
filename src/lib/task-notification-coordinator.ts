import { CrossTabLeaderCoordinator } from '@/lib/cross-tab-leader-coordinator';

export type TaskNotificationCoordinatorMessage =
  | { kind: 'snapshot'; userId: number; activeCount: number; cursor: string }
  | { kind: 'consumed'; userId: number; eventId: string };

interface CoordinatorCallbacks {
  onLeaderChange: (isLeader: boolean) => void;
  onMessage: (message: TaskNotificationCoordinatorMessage) => void;
}

export class TaskNotificationCoordinator {
  private readonly coordinator: CrossTabLeaderCoordinator<TaskNotificationCoordinatorMessage>;

  constructor(
    userId: number,
    callbacks: CoordinatorCallbacks,
  ) {
    this.coordinator = new CrossTabLeaderCoordinator(`ai-task-notification:${userId}`, {
      onLeaderChange: callbacks.onLeaderChange,
      onMessage: (message) => {
        if (message?.userId === userId) callbacks.onMessage(message);
      },
    });
  }

  start() {
    this.coordinator.start();
  }

  stop() {
    this.coordinator.stop();
  }

  broadcast(message: TaskNotificationCoordinatorMessage) {
    this.coordinator.broadcast(message);
  }
}
