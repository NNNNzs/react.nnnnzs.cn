/**
 * Next.js Instrumentation Hook
 * 在应用启动时执行初始化代码
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 注意: Qdrant 初始化已移至独立脚本，使用 pnpm run qdrant:init 手动初始化
 */

type ImageGenerationQueue = typeof import('@/services/image-gen-job')['imageGenerationQueue'];

/**
 * 恢复卡住的异步任务
 * 容器重启后，PROCESSING 状态的任务需要重置为 FAILED，
 * PENDING 状态的任务需要重新入队处理。
 */
async function recoverStaleJobs(imageGenerationQueue: ImageGenerationQueue) {
  const { prisma } = await import('@/lib/prisma');
  const { setImageGenerationRecoverySnapshot } = await import('@/services/image-gen-job');

  // 将崩溃时残留的 PROCESSING 任务标记为 FAILED
  const { count: staleProcessing } = await prisma.tbImageGenLog.updateMany({
    where: { status: 'PROCESSING' },
    data: {
      status: 'FAILED',
      error_message: '服务重启，任务被中断',
      finished_at: new Date(),
    },
  });

  if (staleProcessing > 0) {
    console.warn(`图片生成队列恢复: ${staleProcessing} 个 PROCESSING 任务已标记为 FAILED`);
  }

  // 将 PENDING 任务重新入队
  const pendingJobs = await prisma.tbImageGenLog.findMany({
    where: { status: 'PENDING', job_id: { not: null } },
    select: { job_id: true },
  });
  const pendingJobIds = pendingJobs
    .map((job) => job.job_id)
    .filter((jobId): jobId is string => Boolean(jobId));

  if (pendingJobIds.length > 0) {
    console.log(`图片生成队列恢复: ${pendingJobIds.length} 个 PENDING 任务重新入队`);
    for (const jobId of pendingJobIds) {
      imageGenerationQueue.add({
        id: jobId,
        type: 'image-generation',
        payload: { jobId },
        title: '恢复任务',
        priority: 5,
        addTime: Date.now(),
      });
    }
  }

  setImageGenerationRecoverySnapshot({
    recoveredAt: new Date().toISOString(),
    staleProcessingCount: staleProcessing,
    requeuedPendingCount: pendingJobIds.length,
  });
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { imageGenerationQueue } = await import('@/services/image-gen-job');
    console.log('初始化图片生成队列...');
    await recoverStaleJobs(imageGenerationQueue);
    imageGenerationQueue.start();
  }
}
