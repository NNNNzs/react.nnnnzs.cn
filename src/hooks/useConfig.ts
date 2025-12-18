/**
 * 通用配置获取 Hook
 *
 * 从配置服务批量获取配置项的值
 * 使用方法：
 * const { values, loading, error } = useConfig(["algolia_app_id", "algolia_api_key"] as const);
 * const appId = values.algolia_app_id;
 */
import { useEffect, useState } from "react";

/**
 * 配置接口返回的数据结构
 */
interface ConfigItem {
  key: string;
  value: string | null;
}

interface ConfigResponse {
  status: boolean;
  message?: string;
  data?: ConfigItem | null;
}

interface UseConfigResult<TKeys extends readonly string[]> {
  /**
   * 配置键值对
   */
  values: Partial<Record<TKeys[number], string>>;
  /**
   * 是否正在加载
   */
  loading: boolean;
  /**
   * 错误信息
   */
  error: Error | null;
}

/**
 * 批量获取配置的 Hook
 *
 * @param keys 需要查询的配置 key 列表（使用 as const 可以获得更好类型提示）
 * @returns 包含 values、loading、error 的对象
 */
export function useConfig<TKeys extends readonly string[]>(
  keys: TKeys
): UseConfigResult<TKeys> {
  const [values, setValues] = useState<Partial<Record<TKeys[number], string>>>(
    {}
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!keys.length) {
      return;
    }

    let cancelled = false;

    const fetchConfigs = async () => {
      setLoading(true);
      setError(null);

      try {
        const responses = await Promise.all(
          keys.map((key) =>
            fetch(`/api/config/key/${encodeURIComponent(key)}`).then(
              async (res) => {
                if (!res.ok) {
                  throw new Error(`获取配置失败: ${key}`);
                }
                const data = (await res.json()) as ConfigResponse;
                if (!data.status || !data.data) {
                  throw new Error(
                    data.message || `配置不存在或无效: ${key}`
                  );
                }
                return data.data;
              }
            )
          )
        );

        if (cancelled) {
          return;
        }

        const nextValues: Partial<Record<TKeys[number], string>> = {};

        responses.forEach((item) => {
          if (item.value != null) {
            nextValues[item.key as TKeys[number]] = item.value;
          }
        });

        setValues(nextValues);
      } catch (err) {
        if (cancelled) {
          return;
        }
        // 统一错误处理为 Error 类型
        if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error("获取配置失败"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchConfigs();

    return () => {
      cancelled = true;
    };
  }, [keys]);

  return {
    values,
    loading,
    error,
  };
}


