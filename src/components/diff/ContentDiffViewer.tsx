"use client";

import React from "react";
import { Spin } from "antd";
import dynamic from "next/dynamic";
import type {
  ReactDiffViewerProps,
  ReactDiffViewerStylesOverride,
} from "react-diff-viewer-continued";

const ReactDiffViewer = dynamic<ReactDiffViewerProps>(
  () => import("react-diff-viewer-continued"),
  { ssr: false, loading: () => <Spin tip="加载对比组件..." /> },
);

const DEFAULT_DIFF_STYLES: ReactDiffViewerStylesOverride = {
  variables: {
    light: {
      diffViewerBackground: "#fff",
      diffViewerColor: "#212121",
      addedBackground: "#e6ffec",
      addedColor: "#24292e",
      removedBackground: "#ffebe9",
      removedColor: "#24292e",
      wordAddedBackground: "#acf2bd",
      wordRemovedBackground: "#ffc0c0",
      addedGutterBackground: "#cdffd8",
      removedGutterBackground: "#ffdce0",
      gutterBackground: "#f7f7f7",
      gutterBackgroundDark: "#f0f0f0",
      highlightBackground: "#fffbdd",
      highlightGutterBackground: "#fff5b1",
    },
  },
  contentText: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    lineHeight: "1.5",
  },
};

export interface ContentDiffViewerProps {
  oldValue: string;
  newValue: string;
  leftTitle?: ReactDiffViewerProps["leftTitle"];
  rightTitle?: ReactDiffViewerProps["rightTitle"];
  splitView?: boolean;
  showDiffOnly?: boolean;
  className?: string;
}

export function ContentDiffViewer({
  oldValue,
  newValue,
  leftTitle,
  rightTitle,
  splitView = true,
  showDiffOnly = false,
  className,
}: ContentDiffViewerProps) {
  const viewer = (
    <ReactDiffViewer
      oldValue={oldValue}
      newValue={newValue}
      splitView={splitView}
      showDiffOnly={showDiffOnly}
      useDarkTheme={false}
      leftTitle={leftTitle}
      rightTitle={rightTitle}
      styles={DEFAULT_DIFF_STYLES}
    />
  );

  if (!className) return viewer;
  return <div className={className}>{viewer}</div>;
}
