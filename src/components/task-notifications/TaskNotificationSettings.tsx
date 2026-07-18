"use client";

import React from 'react';
import { Alert, Button, Checkbox, Modal, Space, Switch, Tag, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useTaskNotifications } from '@/contexts/TaskNotificationContext';
import type { TaskNotificationJobType } from '@/types/task-notification';

interface TaskNotificationSettingsProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { label: '图片生成', value: 'image-gen' },
  { label: '语音合成', value: 'tts' },
];

export default function TaskNotificationSettings({ open, onClose }: TaskNotificationSettingsProps) {
  const {
    supported,
    permission,
    preferences,
    activeCount,
    requestPermission,
    updatePreferences,
  } = useTaskNotifications();

  const permissionLabel = permission === 'granted'
    ? <Tag color="success">已授权</Tag>
    : permission === 'denied'
      ? <Tag color="error">已阻止</Tag>
      : permission === 'default'
        ? <Tag>未授权</Tag>
        : <Tag>不支持</Tag>;

  return (
    <Modal title={<Space><BellOutlined />任务通知</Space>} open={open} onCancel={onClose} footer={null}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <Typography.Text strong>桌面任务通知</Typography.Text>
            <div className="mt-1 text-xs text-slate-500">当前有 {activeCount} 个任务正在排队或处理</div>
          </div>
          {permissionLabel}
        </div>

        {!supported ? (
          <Alert type="warning" showIcon title="当前浏览器不支持桌面通知或 Service Worker" />
        ) : permission === 'denied' ? (
          <Alert type="warning" showIcon title="通知权限已被浏览器阻止" description="请在浏览器的网站设置中允许通知后刷新页面。" />
        ) : permission !== 'granted' ? (
          <Button type="primary" icon={<BellOutlined />} onClick={() => void requestPermission()}>
            开启桌面通知
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
              <span>启用任务通知</span>
              <Switch checked={preferences.enabled} onChange={(enabled) => updatePreferences({ enabled })} />
            </div>

            <div>
              <Typography.Text className="mb-2 block text-sm">通知任务类型</Typography.Text>
              <Checkbox.Group
                options={TYPE_OPTIONS}
                value={preferences.types}
                onChange={(values) => updatePreferences({ types: values as TaskNotificationJobType[] })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span>任务成功</span>
                <Switch size="small" checked={preferences.notifySuccess} onChange={(notifySuccess) => updatePreferences({ notifySuccess })} />
              </div>
              <div className="flex items-center justify-between">
                <span>任务失败</span>
                <Switch size="small" checked={preferences.notifyFailure} onChange={(notifyFailure) => updatePreferences({ notifyFailure })} />
              </div>
              <div className="flex items-center justify-between">
                <span>页面隐藏时使用系统桌面通知</span>
                <Switch size="small" checked={preferences.desktopWhenHidden} onChange={(desktopWhenHidden) => updatePreferences({ desktopWhenHidden })} />
              </div>
            </div>
          </>
        )}

        <Alert
          type="info"
          showIcon
          title="首版运行边界"
          description="站点仍在浏览器中运行时可以通知；浏览器完全退出后的离线推送暂未启用。"
        />
      </div>
    </Modal>
  );
}
