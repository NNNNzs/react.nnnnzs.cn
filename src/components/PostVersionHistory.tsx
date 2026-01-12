'use client';

/**
 * 文章版本历史组件
 * 显示版本列表和 diff 对比弹窗
 */

import React, { useState, useCallback } from 'react';
import { Button, Modal, List, Select, Spin, Empty, message, Tooltip } from 'antd';
import { HistoryOutlined, SwapOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import axios from '@/lib/axios';

// 动态导入 diff viewer（避免 SSR 问题）
const ReactDiffViewer = dynamic(
  () => import('react-diff-viewer-continued'),
  { ssr: false, loading: () => <Spin tip="加载对比组件..." /> }
);

interface PostVersionHistoryProps {
  /** 文章 ID */
  postId: number;
}

interface VersionItem {
  id: number;
  postId: number;
  version: number;
  createdAt: string;
  createdBy: number | null;
  contentLength: number;
}

interface DiffData {
  fromVersion: number;
  toVersion: number;
  oldContent: string;
  newContent: string;
  currentVersion: number;
}

/**
 * 文章版本历史组件
 */
export default function PostVersionHistory({ postId }: PostVersionHistoryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [selectedFromVersion, setSelectedFromVersion] = useState<number | null>(null);
  const [selectedToVersion, setSelectedToVersion] = useState<number | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  /**
   * 加载版本列表
   */
  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/post/${postId}/versions`);
      if (response.data.status) {
        const versionList = response.data.data.versions || [];
        setVersions(versionList);
        
        // 如果有版本，默认选择最新两个版本进行对比
        if (versionList.length >= 2) {
          setSelectedToVersion(versionList[0].version);
          setSelectedFromVersion(versionList[1].version);
        } else if (versionList.length === 1) {
          setSelectedToVersion(versionList[0].version);
          setSelectedFromVersion(0); // 与初始空内容对比
        }
      } else {
        message.error(response.data.message || '加载版本列表失败');
      }
    } catch (error) {
      console.error('加载版本列表失败:', error);
      message.error('加载版本列表失败');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  /**
   * 加载版本对比数据
   */
  const loadDiff = useCallback(async (fromVersion: number, toVersion: number) => {
    setIsDiffLoading(true);
    try {
      const response = await axios.get(`/api/post/${postId}/versions/diff`, {
        params: { from: fromVersion, to: toVersion },
      });
      if (response.data.status) {
        setDiffData(response.data.data);
        setShowDiff(true);
      } else {
        message.error(response.data.message || '加载版本对比失败');
      }
    } catch (error) {
      console.error('加载版本对比失败:', error);
      message.error('加载版本对比失败');
    } finally {
      setIsDiffLoading(false);
    }
  }, [postId]);

  /**
   * 打开弹窗
   */
  const handleOpen = () => {
    setIsModalOpen(true);
    setShowDiff(false);
    loadVersions();
  };

  /**
   * 关闭弹窗
   */
  const handleClose = () => {
    setIsModalOpen(false);
    setShowDiff(false);
    setDiffData(null);
  };

  /**
   * 执行版本对比
   */
  const handleCompare = () => {
    if (selectedFromVersion === null || selectedToVersion === null) {
      message.warning('请选择要对比的版本');
      return;
    }
    loadDiff(selectedFromVersion, selectedToVersion);
  };

  /**
   * 返回版本列表
   */
  const handleBackToList = () => {
    setShowDiff(false);
    setDiffData(null);
  };

  /**
   * 版本选项
   */
  const versionOptions = [
    { value: 0, label: '初始版本（空）' },
    ...versions.map((v) => ({
      value: v.version,
      label: `版本 ${v.version} - ${dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')}`,
    })),
  ];

  return (
    <>
      <Tooltip title="查看版本历史">
        <Button
          type="default"
          icon={<HistoryOutlined />}
          onClick={handleOpen}
        >
          版本历史
        </Button>
      </Tooltip>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <HistoryOutlined />
            <span>版本历史</span>
            {showDiff && diffData && (
              <span className="text-sm font-normal text-gray-500">
                - 版本 {diffData.fromVersion} → 版本 {diffData.toVersion}
              </span>
            )}
          </div>
        }
        open={isModalOpen}
        onCancel={handleClose}
        footer={null}
        width={showDiff ? '90vw' : 600}
        style={{ top: 20 }}
        styles={{
          body: { maxHeight: 'calc(100vh - 150px)', overflow: 'auto' },
        }}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spin tip="加载版本列表..." />
          </div>
        ) : versions.length === 0 ? (
          <Empty description="暂无版本记录" />
        ) : showDiff && diffData ? (
          // Diff 视图
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={handleBackToList}>返回版本列表</Button>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedFromVersion}
                  onChange={setSelectedFromVersion}
                  options={versionOptions.filter((o) => o.value !== selectedToVersion)}
                  style={{ width: 220 }}
                  placeholder="选择旧版本"
                />
                <SwapOutlined />
                <Select
                  value={selectedToVersion}
                  onChange={setSelectedToVersion}
                  options={versionOptions.filter((o) => o.value !== selectedFromVersion && o.value !== 0)}
                  style={{ width: 220 }}
                  placeholder="选择新版本"
                />
                <Button type="primary" onClick={handleCompare} loading={isDiffLoading}>
                  对比
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <ReactDiffViewer
                oldValue={diffData.oldContent}
                newValue={diffData.newContent}
                splitView={true}
                showDiffOnly={false}
                useDarkTheme={false}
                leftTitle={`版本 ${diffData.fromVersion}${diffData.fromVersion === 0 ? '（初始）' : ''}`}
                rightTitle={`版本 ${diffData.toVersion}${diffData.toVersion === diffData.currentVersion ? '（当前）' : ''}`}
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#fff',
                      diffViewerColor: '#212121',
                      addedBackground: '#e6ffec',
                      addedColor: '#24292e',
                      removedBackground: '#ffebe9',
                      removedColor: '#24292e',
                      wordAddedBackground: '#acf2bd',
                      wordRemovedBackground: '#ffc0c0',
                      addedGutterBackground: '#cdffd8',
                      removedGutterBackground: '#ffdce0',
                      gutterBackground: '#f7f7f7',
                      gutterBackgroundDark: '#f0f0f0',
                      highlightBackground: '#fffbdd',
                      highlightGutterBackground: '#fff5b1',
                    },
                  },
                  contentText: {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  },
                }}
              />
            </div>
          </div>
        ) : (
          // 版本列表视图
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
              <span className="text-gray-600 dark:text-gray-300">选择版本进行对比：</span>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedFromVersion}
                  onChange={setSelectedFromVersion}
                  options={versionOptions.filter((o) => o.value !== selectedToVersion)}
                  style={{ width: 220 }}
                  placeholder="选择旧版本"
                />
                <SwapOutlined />
                <Select
                  value={selectedToVersion}
                  onChange={setSelectedToVersion}
                  options={versionOptions.filter((o) => o.value !== selectedFromVersion && o.value !== 0)}
                  style={{ width: 220 }}
                  placeholder="选择新版本"
                />
                <Button 
                  type="primary" 
                  onClick={handleCompare} 
                  loading={isDiffLoading}
                  disabled={selectedFromVersion === null || selectedToVersion === null}
                >
                  对比
                </Button>
              </div>
            </div>

            <List
              dataSource={versions}
              renderItem={(item) => (
                <List.Item
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  actions={[
                    <Button
                      key="compare"
                      type="link"
                      size="small"
                      onClick={() => {
                        // 选择当前版本与上一个版本对比
                        const prevVersion = item.version > 1 ? item.version - 1 : 0;
                        setSelectedFromVersion(prevVersion);
                        setSelectedToVersion(item.version);
                        loadDiff(prevVersion, item.version);
                      }}
                    >
                      查看变更
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span className="font-medium">
                        版本 {item.version}
                        {item.version === versions[0]?.version && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                            当前版本
                          </span>
                        )}
                      </span>
                    }
                    description={
                      <div className="text-gray-500 text-sm">
                        <span>{dayjs(item.createdAt).format('YYYY年MM月DD日 HH:mm:ss')}</span>
                        <span className="mx-2">·</span>
                        <span>{item.contentLength.toLocaleString()} 字符</span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
