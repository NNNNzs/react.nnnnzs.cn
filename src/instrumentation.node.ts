/**
 * Node.js Instrumentation
 *
 * 在 Next.js Node.js runtime 启动时执行的初始化逻辑。
 * 包括恢复异步任务队列。
 */

export async function registerNodeInstrumentation() {
  // 初始化图片生成队列
  const { imageGenerationQueue, setImageGenerationRecoverySnapshot } = await import('@/services/image-gen-job');
  const { recoverStaleJobs } = await import('@/services/ai-job');

  console.log('初始化图片生成队列...');
  const imageRecovery = await recoverStaleJobs(imageGenerationQueue, 'image-gen');
  setImageGenerationRecoverySnapshot(imageRecovery);

  if (imageRecovery.staleProcessingCount > 0) {
    console.warn(`图片生成队列恢复: ${imageRecovery.staleProcessingCount} 个 PROCESSING 任务已标记为 FAILED`);
  }
  if (imageRecovery.requeuedPendingCount > 0) {
    console.log(`图片生成队列恢复: ${imageRecovery.requeuedPendingCount} 个 PENDING 任务重新入队`);
  }

  imageGenerationQueue.start();

  // 初始化 TTS 队列
  const { ttsQueue, setTtsRecoverySnapshot } = await import('@/services/tts-job');

  console.log('初始化 TTS 队列...');
  const ttsRecovery = await recoverStaleJobs(ttsQueue, 'tts');
  setTtsRecoverySnapshot(ttsRecovery);

  if (ttsRecovery.staleProcessingCount > 0) {
    console.warn(`TTS 队列恢复: ${ttsRecovery.staleProcessingCount} 个 PROCESSING 任务已标记为 FAILED`);
  }
  if (ttsRecovery.requeuedPendingCount > 0) {
    console.log(`TTS 队列恢复: ${ttsRecovery.requeuedPendingCount} 个 PENDING 任务重新入队`);
  }

  ttsQueue.start();
}
