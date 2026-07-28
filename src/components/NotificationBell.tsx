'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Dropdown, List, Typography } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { useCrossTabLeader } from '@/hooks/useCrossTabLeader';

interface NotificationItem {
  id: number;
  title: string;
  preview: string;
  target_url: string;
  read_at: string | null;
  created_at: string;
  actor: { nickname: string; avatar: string | null } | null;
}

interface NotificationSummary {
  unreadCount: number;
  recent: NotificationItem[];
}

type NotificationSummaryMessage = { kind: 'snapshot'; value: NotificationSummary };

export default function NotificationBell({ userId }: { userId: number }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);

  const applySummary = useCallback((summary: NotificationSummary) => {
    setUnreadCount(summary.unreadCount);
    setRecent(summary.recent);
  }, []);

  const { isLeader, broadcast } = useCrossTabLeader<NotificationSummaryMessage>(
    `notification-summary:${userId}`,
    (message) => {
      if (message.kind === 'snapshot') applySummary(message.value);
    },
    true,
  );

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/notifications/summary', {
      cache: 'no-store',
      credentials: 'include',
      signal,
    });
    if (!response.ok) throw new Error(`查询通知摘要失败: ${response.status}`);
    const payload = await response.json() as { status: boolean; data: NotificationSummary };
    if (!payload.status) throw new Error('通知摘要响应无效');
    applySummary(payload.data);
    broadcast({ kind: 'snapshot', value: payload.data });
  }, [applySummary, broadcast]);

  const { runNow } = useAdaptivePolling({
    enabled: isLeader,
    initialJitterMaxMs: 3_000,
    pauseWhenHidden: true,
    refreshOnVisible: true,
    backoffBaseMs: 60_000,
    maxBackoffMs: 300_000,
    poll: async ({ signal }) => {
      await refresh(signal);
      return 60_000;
    },
  });

  const markRead = async (item: NotificationItem) => {
    if (!item.read_at) {
      await fetch(`/api/notifications/${item.id}`, { method: 'PATCH', credentials: 'include' });
      if (isLeader) runNow();
      else void refresh().catch(() => {});
    }
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    if (isLeader) runNow();
    else void refresh().catch(() => {});
  };

  const menu = (
    <div className="w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between px-2 pb-2">
        <Typography.Text strong>通知</Typography.Text>
        <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => void markAllRead()} disabled={!unreadCount}>全部已读</Button>
      </div>
      <List
        size="small"
        dataSource={recent}
        locale={{ emptyText: '暂无通知' }}
        renderItem={(item) => (
          <List.Item className={item.read_at ? '' : 'bg-blue-50/70 dark:bg-blue-950/20'}>
            <Link href={item.target_url} onClick={() => void markRead(item)} className="block w-full px-1">
              <Typography.Text strong={!item.read_at}>{item.title}</Typography.Text>
              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.preview}</div>
            </Link>
          </List.Item>
        )}
      />
      <div className="pt-2 text-center"><Link href="/notifications">查看全部通知</Link></div>
    </div>
  );

  return (
    <Dropdown popupRender={() => menu} trigger={['hover']} placement="bottomRight">
      <button type="button" className="cursor-pointer p-2 rounded-full text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="通知">
        <Badge count={unreadCount} size="small" overflowCount={99}><BellOutlined className="text-lg" /></Badge>
      </button>
    </Dropdown>
  );
}
