/**
 * 通用后台任务队列
 * 用于承载不同类型的长耗时任务，如向量化、图片生成等。
 */

export interface QueueTask<TType extends string = string, TPayload = unknown> {
  id: string;
  type: TType;
  payload: TPayload;
  title?: string;
  priority: number;
  addTime: number;
}

export interface QueueTaskSnapshot {
  id: string;
  type: string;
  title?: string;
  priority: number;
  addTime: number;
}

export interface QueueStatusSnapshot {
  queueLength: number;
  processingCount: number;
  queueTasks: QueueTaskSnapshot[];
  processingTasks: string[];
  isRunning: boolean;
}

export interface TaskQueueOptions {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  checkInterval: number;
}

export interface TaskQueueHandler<TTask extends QueueTask> {
  process: (task: TTask, attempt: number) => Promise<void>;
  onSuccess?: (task: TTask) => Promise<void> | void;
  onRetry?: (task: TTask, error: unknown, nextAttempt: number) => Promise<void> | void;
  onFailure?: (task: TTask, error: unknown) => Promise<void> | void;
}

const DEFAULT_OPTIONS: TaskQueueOptions = {
  name: 'background',
  concurrency: 1,
  maxRetries: 2,
  retryDelay: 5000,
  checkInterval: 1000,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TaskQueue<TTask extends QueueTask> {
  private queue: TTask[] = [];
  private processing = new Map<string, TTask>();
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly options: TaskQueueOptions;

  constructor(
    options: Partial<TaskQueueOptions>,
    private readonly handler: TaskQueueHandler<TTask>,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`启动后台队列 ${this.options.name}`);
    this.schedule();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  add(task: TTask): boolean {
    const exists = this.queue.some((item) => item.id === task.id) || this.processing.has(task.id);
    if (exists) {
      console.log(`任务 ${task.id} 已在队列 ${this.options.name} 中`);
      return false;
    }

    this.queue.push(task);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.addTime - b.addTime;
    });

    if (!this.isRunning) {
      this.start();
    } else {
      this.schedule();
    }

    return true;
  }

  addBatch(tasks: TTask[]) {
    const newTasks: TTask[] = [];
    for (const task of tasks) {
      const exists = this.queue.some((item) => item.id === task.id) || this.processing.has(task.id);
      if (exists) {
        console.log(`任务 ${task.id} 已在队列 ${this.options.name} 中`);
      } else {
        newTasks.push(task);
      }
    }

    if (newTasks.length === 0) return;

    this.queue.push(...newTasks);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.addTime - b.addTime;
    });

    if (!this.isRunning) {
      this.start();
    } else {
      this.schedule();
    }
  }

  has(id: string) {
    return this.processing.has(id) || this.queue.some((task) => task.id === id);
  }

  getStatus(): QueueStatusSnapshot {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      queueTasks: this.queue.map((task) => ({
        id: task.id,
        type: task.type,
        title: task.title,
        priority: task.priority,
        addTime: task.addTime,
      })),
      processingTasks: Array.from(this.processing.keys()),
      isRunning: this.isRunning,
    };
  }

  private schedule() {
    if (!this.isRunning || this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.process();
    }, this.options.checkInterval);
  }

  private process() {
    if (!this.isRunning) return;

    while (
      this.processing.size < this.options.concurrency &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift();
      if (!task) break;

      this.processing.set(task.id, task);
      void this.runTask(task);
    }

    this.schedule();
  }

  private async runTask(task: TTask) {
    try {
      for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
        try {
          await this.handler.process(task, attempt);
          await this.handler.onSuccess?.(task);
          return;
        } catch (error) {
          if (attempt >= this.options.maxRetries) {
            await this.handler.onFailure?.(task, error);
            throw error;
          }

          const nextAttempt = attempt + 1;
          await this.handler.onRetry?.(task, error, nextAttempt);
          await sleep(this.options.retryDelay);
        }
      }
    } catch (error) {
      console.error(`队列 ${this.options.name} 任务 ${task.id} 失败:`, error);
    } finally {
      this.processing.delete(task.id);
      this.schedule();
    }
  }
}
