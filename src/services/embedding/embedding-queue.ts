/**
 * 向量化异步队列系统
 * 使用内存队列管理向量化任务
 */

import { getPrisma } from '@/lib/prisma';
import { simpleEmbedPost, type SimpleEmbedParams } from './simple-embedder';

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
class EmbeddingQueue {
  private queue: EmbedTask[] = [];
  private processing = new Set<number>();
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  /**
   * 启动队列
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 向量化队列已在运行');
      return;
    }

    console.log('🚀 启动向量化队列');
    console.log(`📊 配置: 并发=${QUEUE_CONFIG.concurrency}, 最大重试=${QUEUE_CONFIG.maxRetries}`);
    this.isRunning = true;
    this.schedule();
  }

  /**
   * 停止队列
   */
  stop() {
    console.log('⏸️ 停止向量化队列');
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 添加任务到队列
   */
  add(task: EmbedTask): void {
    // 检查是否已在队列中
    const exists = this.queue.some(t => t.postId === task.postId);
    if (exists) {
      console.log(`⚠️ 文章 ${task.postId} 已在队列中`);
      return;
    }

    // 检查是否正在处理
    if (this.processing.has(task.postId)) {
      console.log(`⚠️ 文章 ${task.postId} 正在处理中`);
      return;
    }

    // 添加到队列并排序（按优先级和时间）
    this.queue.push(task);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.addTime - b.addTime;
    });

    console.log(`📥 文章 ${task.postId} 已添加到队列，当前队列长度: ${this.queue.length}`);

    // 如果队列未运行，自动启动
    if (!this.isRunning) {
      console.log('⚠️ 队列未运行，自动启动');
      this.start();
    }
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
  } {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      queueTasks: this.queue.map(t => ({
        postId: t.postId,
        title: t.title,
        priority: t.priority,
      })),
      processingTasks: Array.from(this.processing),
    };
  }

  /**
   * 调度下一个任务
   */
  private schedule() {
    if (!this.isRunning) {
      return;
    }

    this.timer = setTimeout(() => {
      this.process();
    }, QUEUE_CONFIG.checkInterval);
  }

  /**
   * 处理队列中的任务
   */
  private async process() {
    // console.log(`🔄 检查队列: 队列长度=${this.queue.length}, 处理中=${this.processing.size}, 并发限制=${QUEUE_CONFIG.concurrency}`);

    // 检查是否达到并发限制
    if (this.processing.size >= QUEUE_CONFIG.concurrency) {
      // console.log(`⏸️ 已达到并发限制 ${QUEUE_CONFIG.concurrency}，等待任务完成`);
      this.schedule();
      return;
    }

    // 检查队列是否为空
    if (this.queue.length === 0) {
      // console.log(`📭 队列为空，等待新任务`);
      this.schedule();
      return;
    }

    // 取出下一个任务
    const task = this.queue.shift();
    if (!task) {
      this.schedule();
      return;
    }

    console.log(`🎯 取出任务: 文章 ${task.postId} (${task.title})`);

    // 标记为处理中
    this.processing.add(task.postId);

    // 处理任务
    this.processTask(task)
      .catch((error) => {
        console.error(`❌ 处理任务 ${task.postId} 时出错:`, error);
      })
      .finally(() => {
        // 移除处理标记
        this.processing.delete(task.postId);
        console.log(`✅ 文章 ${task.postId} 处理完成，剩余队列: ${this.queue.length}`);
        // 继续调度
        this.schedule();
      });

    // 立即检查是否可以处理更多任务
    if (this.queue.length > 0 && this.processing.size < QUEUE_CONFIG.concurrency) {
      console.log(`🚀 继续处理下一个任务...`);
      setImmediate(() => this.process());
    }
  }

  /**
   * 处理单个任务（带重试机制）
   */
  private async processTask(task: EmbedTask, retryCount = 0): Promise<void> {
    const { postId } = task;

    console.log(`🔄 开始处理文章 ${postId} 的向量化...`);

    try {
      // 1. 更新数据库状态为 processing
      await this.updatePostStatus(postId, EmbedStatus.PROCESSING);

      // 2. 执行向量化
      await simpleEmbedPost({
        postId: task.postId,
        title: task.title,
        content: task.content,
        hide: task.hide,
      });

      // 3. 更新数据库状态为 completed
      await this.updatePostStatus(postId, EmbedStatus.COMPLETED, {
        ragUpdatedAt: new Date(),
      });

      console.log(`✅ 文章 ${postId} 向量化完成`);
    } catch (error) {
      console.error(`❌ 文章 ${postId} 向量化失败:`, error);

      // 检查是否需要重试
      if (retryCount < QUEUE_CONFIG.maxRetries) {
        console.log(`🔄 重试文章 ${postId} 的向量化 (${retryCount + 1}/${QUEUE_CONFIG.maxRetries})...`);

        // 延迟后重试
        await new Promise((resolve) => setTimeout(resolve, QUEUE_CONFIG.retryDelay));

        // 递归重试
        return this.processTask(task, retryCount + 1);
      }

      // 重试次数用尽，标记为失败
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      await this.updatePostStatus(postId, EmbedStatus.FAILED, {
        ragError: errorMessage,
      });

      console.error(`❌ 文章 ${postId} 向量化最终失败，已重试 ${retryCount} 次`);
    }
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
