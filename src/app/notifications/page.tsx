'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox, Empty, List, Pagination, Spin, Typography } from 'antd';

interface NotificationItem {
  id: number;
  title: string;
  preview: string;
  target_url: string;
  read_at: string | null;
  created_at: string;
  actor: { nickname: string } | null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '20', unreadOnly: String(unreadOnly) });
      const response = await fetch(`/api/notifications?${query}`, { cache: 'no-store', credentials: 'include' });
      const payload = await response.json() as { status: boolean; data: { total: number; record: NotificationItem[] } };
      if (payload.status) { setItems(payload.data.record); setTotal(payload.data.total); }
    } finally { setLoading(false); }
  }, [page, unreadOnly]);

  useEffect(() => { void load(); }, [load]);
  const markRead = async (item: NotificationItem) => {
    if (!item.read_at) await fetch(`/api/notifications/${item.id}`, { method: 'PATCH', credentials: 'include' });
    void load();
  };
  const markAllRead = async () => { await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }); void load(); };

  return <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10">
    <div className="mb-6 flex items-center justify-between"><div><Typography.Title level={2} className="!mb-1">通知中心</Typography.Title><Typography.Text type="secondary">评论互动与回复消息</Typography.Text></div><Button onClick={() => void markAllRead()}>全部已读</Button></div>
    <Checkbox checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }}>仅看未读</Checkbox>
    <div className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {loading ? <div className="p-12 text-center"><Spin /></div> : <List dataSource={items} locale={{ emptyText: <Empty description="暂无通知" /> }} renderItem={(item) => <List.Item className={item.read_at ? '' : 'bg-blue-50/60 dark:bg-blue-950/20'}><Link href={item.target_url} className="block w-full px-2" onClick={() => void markRead(item)}><Typography.Text strong={!item.read_at}>{item.title}</Typography.Text><div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.preview}</div><div className="mt-1 text-xs text-slate-400">{item.actor?.nickname || '系统'} · {new Date(item.created_at).toLocaleString('zh-CN')}</div></Link></List.Item>} />}
    </div>
    {total > 20 ? <div className="mt-6 text-center"><Pagination current={page} total={total} pageSize={20} onChange={setPage} /></div> : null}
  </main>;
}
