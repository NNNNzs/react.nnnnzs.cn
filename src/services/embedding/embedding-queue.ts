/**
 * 向量化异步队列系统
 * 使用内存队列管理向量化任务
 */

import { getPrisma } from '@/lib/prisma';
import { simpleEmbedPost, type SimpleEmbedParams } from './simple-embedder';
import { TaskQueue, type QueueTask } from '@/services/queue/task-queue';

/**
 * 向量化状态枚举
 */
export enum EmbedStatus {
  PENDING = 'pending',       // 待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed',         // 失败
}

/**
 * 向量化任务
 */
export interface EmbedTask {
  postId: number;
  title: string;
  content: string;
  hide?: string;
  priority: number; // 优先级（数字越小优先级越高）
  addTime: number; // 添加时间
}

/**
 * 队列配置
 */
const QUEUE_CONFIG = {
  // 并发处理数量
  concurrency: 2,
  // 任务重试次数
  maxRetries: 2,
  // 重试延迟（毫秒）
  retryDelay: 5000,
  // 队列检查间隔（毫秒）
  checkInterval: 1000,
};

/**
 * 向量化队列类
 */
type EmbeddingQueueTask = QueueTask<'embedding', EmbedTask>;

class EmbeddingQueue {
  private readonly queue = new TaskQueue<EmbeddingQueueTask>(
    {
      name: 'embedding',
      concurrency: QUEUE_CONFIG.concurrency,
      maxRetries: QUEUE_CONFIG.maxRetries,
      retryDelay: QUEUE_CONFIG.retryDelay,
      checkInterval: QUEUE_CONFIG.checkInterval,
    },
    {
      process: async (task) => {
        await this.processTask(task.payload);
      },
      onRetry: (task, _error, nextAttempt) => {
        console.log(`重试文章 ${task.payload.postId} 的向量化 (${nextAttempt}/${QUEUE_CONFIG.maxRetries})...`);
      },
      onFailure: async (task, error) => {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        await this.updatePostStatus(task.payload.postId, EmbedStatus.FAILED, {
          ragError: errorMessage,
        });
      },
    },
  );

  /**
   * 启动队列
   */
  start() {
    this.queue.start();
  }

  /**
   * 停止队列
   */
  stop() {
    this.queue.stop();
  }

  /**
   * 添加任务到队列
   */
  add(task: EmbedTask): void {
    this.queue.add({
      id: String(task.postId),
      type: 'embedding',
      payload: task,
      title: task.title,
      priority: task.priority,
      addTime: task.addTime,
    });
  }

  /**
   * 批量添加任务
   */
  addBatch(tasks: EmbedTask[]): void {
    for (const task of tasks) {
      this.add(task);
    }
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    queueLength: number;
    processingCount: number;
    queueTasks: Array<{ postId: number; title: string; priority: number }>;
    processingTasks: number[];
    isRunning: boolean;
  } {
    const status = this.queue.getStatus();
    return {
      queueLength: status.queueLength,
      processingCount: status.processingCount,
      queueTasks: status.queueTasks.map(t => ({
        postId: Number(t.id),
        title: t.title || '',
        priority: t.priority,
      })),
      processingTasks: status.processingTasks.map(Number),
      isRunning: status.isRunning,
    };
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: EmbedTask): Promise<void> {
    const { postId } = task;

    console.log(`🔄 开始处理文章 ${postId} 的向量化...`);

    await this.updatePostStatus(postId, EmbedStatus.PROCESSING);

    await simpleEmbedPost({
      postId: task.postId,
      title: task.title,
      content: task.content,
      hide: task.hide,
    });

    await this.updatePostStatus(postId, EmbedStatus.COMPLETED, {
      ragUpdatedAt: new Date(),
    });

    console.log(`✅ 文章 ${postId} 向量化完成`);
  }

  /**
   * 更新文章的向量化状态
   */
  private async updatePostStatus(
    postId: number,
    status: EmbedStatus,
    options?: {
      ragError?: string;
      ragUpdatedAt?: Date;
    }
  ): Promise<void> {
    try {
      const prisma = await getPrisma();

      const updateData: {
        rag_status: string;
        rag_error?: string | null;
        rag_updated_at?: Date;
      } = {
        rag_status: status,
      };

      if (options?.ragError !== undefined) {
        updateData.rag_error = options.ragError;
      }

      if (options?.ragUpdatedAt) {
        updateData.rag_updated_at = options.ragUpdatedAt;
      }

      await prisma.tbPost.update({
        where: { id: postId },
        data: updateData,
      });
    } catch (error) {
      console.error(`❌ 更新文章 ${postId} 状态失败:`, error);
      throw error;
    }
  }
}

// 导出单例
export const embeddingQueue = new EmbeddingQueue();

/**
 * 添加文章到向量化队列
 */
export async function queueEmbedPost(params: SimpleEmbedParams & { priority?: number }): Promise<void> {
  const prisma = await getPrisma();

  // 获取文章信息
  const post = await prisma.tbPost.findUnique({
    where: { id: params.postId },
    select: {
      content: true,
      title: true,
      hide: true,
    },
  });

  if (!post) {
    throw new Error(`文章 ${params.postId} 不存在`);
  }

  // 更新状态为 pending
  await prisma.tbPost.update({
    where: { id: params.postId },
    data: {
      rag_status: EmbedStatus.PENDING,
      rag_error: null,
    },
  });

  // 添加到队列
  embeddingQueue.add({
    postId: params.postId,
    title: params.title || post.title || '',
    content: params.content || post.content || '',
    hide: params.hide || post.hide || '0',
    priority: params.priority || 10,
    addTime: Date.now(),
  });
}

/**
 * 批量添加文章到向量化队列
 */
export async function queueEmbedPosts(postIds: number[]): Promise<void> {
  console.log(`📦 批量添加 ${postIds.length} 篇文章到向量化队列...`);

  const prisma = await getPrisma();

  const posts = await prisma.tbPost.findMany({
    where: {
      id: { in: postIds },
      is_delete: 0,
    },
    select: {
      id: true,
      title: true,
      content: true,
      hide: true,
    },
  });

  console.log(`📊 找到 ${posts.length} 篇有效文章`);

  const tasks: EmbedTask[] = posts.map((post) => ({
    postId: post.id,
    title: post.title || '',
    content: post.content || '',
    hide: post.hide || '0',
    priority: 10,
    addTime: Date.now(),
  }));

  // 批量更新状态
  await prisma.tbPost.updateMany({
    where: {
      id: { in: postIds },
    },
    data: {
      rag_status: EmbedStatus.PENDING,
      rag_error: null,
    },
  });

  console.log(`✅ 已更新 ${postIds.length} 篇文章状态为 pending`);

  // 添加到队列
  embeddingQueue.addBatch(tasks);

  console.log(`✅ 已将 ${tasks.length} 个任务添加到队列`);
}

/**
 * 获取队列状态
 */
export function getQueueStatus() {
  return embeddingQueue.getStatus();
}
