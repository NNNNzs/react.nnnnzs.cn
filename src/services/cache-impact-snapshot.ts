export async function bestEffortCacheRead<T>(
  label: string,
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error('[缓存影响] 快照读取失败，继续执行业务操作', {
      label,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
