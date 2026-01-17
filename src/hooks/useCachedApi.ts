/**
 * 带缓存的数据请求 Hook
 * 减少重复的 API 请求，提升性能
 */

import { useState, useEffect, useRef } from 'react';

interface CachedApiOptions<T> {
  cacheKey: string; // 缓存键名
  cacheDuration?: number; // 缓存时长（毫秒），默认 60000（1分钟）
  fetcher: () => Promise<T>; // 数据获取函数
  enabled?: boolean; // 是否启用请求
  onSuccess?: (data: T) => void; // 成功回调
  onError?: (error: unknown) => void; // 失败回调
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

// 全局缓存存储（内存缓存）
const cache = new Map<string, CachedData<unknown>>();

/**
 * 清除指定缓存
 */
export function clearCache(cacheKey: string) {
  cache.delete(cacheKey);
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
  cache.clear();
}

/**
 * 带缓存的数据请求 Hook
 */
export function useCachedApi<T>({
  cacheKey,
  cacheDuration = 60000,
  fetcher,
  enabled = true,
  onSuccess,
  onError,
}: CachedApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 检查缓存
        const cached = cache.get(cacheKey) as CachedData<T> | undefined;
        const now = Date.now();

        // 如果有缓存且未过期，直接使用
        if (cached && now - cached.timestamp < cacheDuration) {
          setData(cached.data);
          onSuccess?.(cached.data);
          setLoading(false);
          return;
        }

        // 请求新数据
        const freshData = await fetcher();

        // 更新缓存
        cache.set(cacheKey, {
          data: freshData,
          timestamp: now,
        });

        setData(freshData);
        onSuccess?.(freshData);
      } catch (err) {
        // 如果是主动取消的请求，不处理错误
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        setError(err);
        onError?.(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      // 组件卸载时取消请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey, cacheDuration, fetcher, enabled, onSuccess, onError]);

  /**
   * 手动刷新数据
   */
  const refetch = () => {
    cache.delete(cacheKey); // 清除缓存
    if (enabled) {
      // 触发重新请求
      setLoading(true);
      fetcher()
        .then((freshData) => {
          cache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now(),
          });
          setData(freshData);
          onSuccess?.(freshData);
        })
        .catch((err) => {
          setError(err);
          onError?.(err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  return {
    data,
    loading,
    error,
    refetch,
  };
}
