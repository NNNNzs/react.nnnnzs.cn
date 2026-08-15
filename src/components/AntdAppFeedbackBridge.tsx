"use client";

import { App } from "antd";
import { useLayoutEffect } from "react";

type AppFeedback = ReturnType<typeof App.useApp>;
type FeedbackKey = "message" | "modal" | "notification";

let feedback: AppFeedback | null = null;

function getFeedback(): AppFeedback {
  if (!feedback) {
    throw new Error("Ant Design App feedback is not ready");
  }

  return feedback;
}

function createFeedbackProxy<Key extends FeedbackKey>(key: Key): AppFeedback[Key] {
  return new Proxy({} as AppFeedback[Key] & object, {
    get(_target, property) {
      const instance = getFeedback()[key];
      const value = Reflect.get(instance as object, property);

      return typeof value === "function" ? value.bind(instance) : value;
    },
  }) as AppFeedback[Key];
}

/**
 * 将 App.useApp() 的上下文实例暴露给历史静态反馈调用。
 * 该组件必须渲染在 Ant Design <App> 内部。
 */
export function AntdAppFeedbackBridge() {
  const appFeedback = App.useApp();

  useLayoutEffect(() => {
    feedback = appFeedback;

    return () => {
      if (feedback === appFeedback) {
        feedback = null;
      }
    };
  }, [appFeedback]);

  return null;
}

export const message = createFeedbackProxy("message");
export const modal = createFeedbackProxy("modal");
export const notification = createFeedbackProxy("notification");
