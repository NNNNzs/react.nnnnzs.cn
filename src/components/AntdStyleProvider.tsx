"use client";

import { StyleProvider } from "@ant-design/cssinjs";
import type { ReactNode } from "react";

/** 将 Ant Design CSS 放入 antd layer，供 Tailwind 业务工具类稳定覆盖。 */
export function AntdStyleProvider({ children }: { children: ReactNode }) {
  return <StyleProvider layer>{children}</StyleProvider>;
}
