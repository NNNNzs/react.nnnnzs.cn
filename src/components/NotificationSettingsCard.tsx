'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Card, Space, Switch, Typography } from 'antd';
import { message } from "@/components/AntdAppFeedbackBridge";
import { BellOutlined, MailOutlined } from '@ant-design/icons';
import type { NotificationSettings } from '@/types/notification';
import { defaultNotificationSettings } from '@/types/notification';

interface Props { hasVerifiedMail: boolean; }

const rows = [
  { key: 'postComment' as const, label: '文章收到评论', description: '有人评论你发布的文章时通知你' },
  { key: 'commentReply' as const, label: '评论收到回复', description: '有人直接回复你的评论时通知你' },
];

export default function NotificationSettingsCard({ hasVerifiedMail }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>(structuredClone(defaultNotificationSettings));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void axios.get('/api/user/notification-settings').then((response) => {
      if (response.data.status) setSettings(response.data.data);
    }).catch(() => message.error('获取通知设置失败')).finally(() => setLoading(false));
  }, []);

  const save = async (next: NotificationSettings) => {
    setSettings(next);
    try {
      const response = await axios.put('/api/user/notification-settings', next);
      if (!response.data.status) throw new Error(response.data.message);
      setSettings(response.data.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存通知设置失败');
    }
  };

  return <Card loading={loading}>
    <Space orientation="vertical" size="middle" className="w-full">
      <div><Typography.Text strong><BellOutlined className="mr-2" />通知设置</Typography.Text><div className="mt-1 text-xs text-slate-500">站内通知是互动消息的收件箱；邮件仅作为额外提醒。</div></div>
      {!hasVerifiedMail ? <Alert type="info" showIcon title="尚未验证邮箱" description="你仍会收到站内通知；绑定并验证邮箱后可开启邮件提醒。" /> : null}
      {rows.map((row) => <div key={row.key} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center justify-between"><div><Typography.Text strong>{row.label}</Typography.Text><div className="text-xs text-slate-500">{row.description}</div></div><Switch checked={settings.inbox[row.key]} onChange={(checked) => void save({ ...settings, inbox: { ...settings.inbox, [row.key]: checked } })} /></div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-sm"><MailOutlined className="mr-2" />邮件提醒</span><Switch size="small" checked={settings.email[row.key]} disabled={!hasVerifiedMail || !settings.inbox[row.key]} onChange={(checked) => void save({ ...settings, email: { ...settings.email, [row.key]: checked } })} /></div>
      </div>)}
    </Space>
  </Card>;
}
