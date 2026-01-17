/**
 * 向量化队列初始化
 * 在应用启动时自动启动队列
 */

import { embeddingQueue } from '@/services/embedding';

let isInitialized = false;

export function initEmbeddingQueue() {
  if (!isInitialized) {
    console.log('🚀 初始化向量化队列...');
    embeddingQueue.start();
    isInitialized = true;
  }
}

// 确保在模块加载时初始化
if (typeof window === 'undefined') {
  // 服务端环境，立即启动
  initEmbeddingQueue();
}
