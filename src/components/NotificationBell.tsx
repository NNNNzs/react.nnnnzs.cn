'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Dropdown, List, Typography } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';

interface NotificationItem {
  id: number;
  title: string;
  preview: string;
  target_url: string;
  read_at: string | null;
  created_at: string;
  actor: { nickname: string; avatar: string | null } | null;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/summary', { cache: 'no-store', credentials: 'include' });
      if (!response.ok) return;
      const payload = await response.json() as { status: boolean; data: { unreadCount: number; recent: NotificationItem[] } };
      if (payload.status) {
        setUnreadCount(payload.data.unreadCount);
        setRecent(payload.data.recent);
      }
    } catch {
      // 静默降级，下一次轮询会恢复。
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const markRead = async (item: NotificationItem) => {
    if (!item.read_at) {
      await fetch(`/api/notifications/${item.id}`, { method: 'PATCH', credentials: 'include' });
      void refresh();
    }
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    void refresh();
  };

  const menu = (
    <div className="w-80 p-2">
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
    <Dropdown popupRender={() => menu} trigger={['click']} placement="bottomRight">
      <button type="button" className="p-2 rounded-full text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="通知">
        <Badge count={unreadCount} size="small" overflowCount={99}><BellOutlined className="text-lg" /></Badge>
      </button>
    </Dropdown>
  );
}
