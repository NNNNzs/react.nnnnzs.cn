'use client';

import { useState } from 'react';
import { Button, Modal, Select, message } from 'antd';
import { EyeOutlined, LinkOutlined } from '@ant-design/icons';
import type { ContentDraftPreviewMode } from '@/types/content-draft-preview';

interface ApiResponse<T> { status: boolean; message: string; data: T; }
interface ShareResult { urls: string[]; }

async function createShare(draftId: number, rotate = false): Promise<ShareResult> {
  const response = await fetch(`/api/create/drafts/${draftId}/preview-share`, {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotate }),
  });
  const payload = await response.json() as ApiResponse<ShareResult>;
  if (!response.ok || !payload.status) throw new Error(payload.message || '创建公开预览失败');
  return payload.data;
}

async function revokeShares(draftId: number): Promise<void> {
  const response = await fetch(`/api/create/drafts/${draftId}/preview-share`, {
    method: 'DELETE', cache: 'no-store',
  });
  const payload = await response.json() as ApiResponse<unknown>;
  if (!response.ok || !payload.status) throw new Error(payload.message || '撤销公开预览失败');
}

function findModeUrl(urls: string[], mode: ContentDraftPreviewMode) {
  return urls.find((url) => url.endsWith(`mode=${mode}`)) ?? urls[0];
}

export function DraftPreviewActions({
  draftId, defaultMode, hasChanges, onSave,
}: {
  draftId: number;
  defaultMode: ContentDraftPreviewMode;
  hasChanges: boolean;
  onSave: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ContentDraftPreviewMode>(defaultMode);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const ensureShare = async (rotate = true) => {
    setLoading(true);
    try {
      const result = await createShare(draftId, rotate);
      setUrls(result.urls);
      return result.urls;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建公开预览失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const preview = async () => {
    if (hasChanges && !(await onSave())) return;
    const previewUrls = await ensureShare();
    const url = previewUrls && findModeUrl(previewUrls, mode);
    if (!url) return;
    if (window.matchMedia('(max-width: 767px)').matches) window.location.assign(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const revoke = async () => {
    setLoading(true);
    try {
      await revokeShares(draftId);
      setUrls([]);
      message.success('所有公开预览链接已撤销');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '撤销公开预览失败');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <Button icon={<EyeOutlined />} loading={loading} onClick={() => void preview()}>
      {hasChanges ? '保存并预览' : '预览'}
    </Button>
    <Button icon={<LinkOutlined />} onClick={() => setOpen(true)}>分享管理</Button>
    <Modal open={open} title="公开预览分享" footer={null} onCancel={() => setOpen(false)}>
      <p className="mb-4 text-sm leading-6 text-slate-600">链接仅展示已保存的草稿内容。新建链接不会公开创作后台；轮换后旧链接将立即失效。链接只在创建时展示一次。</p>
      <div className="flex gap-2">
        <Select value={mode} onChange={setMode} className="min-w-28" options={[
          { value: 'xhs', label: '小红书' }, { value: 'zhihu', label: '知乎' }, { value: 'toutiao', label: '今日头条' },
        ]} />
        <Button loading={loading} onClick={() => void ensureShare(urls.length > 0)}>{urls.length ? '轮换链接' : '创建链接'}</Button>
        <Button color="danger" variant="outlined" loading={loading} onClick={() => void revoke()}>撤销全部</Button>
      </div>
      {urls.length ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs break-all text-slate-700">{findModeUrl(urls, mode)}</div> : null}
    </Modal>
  </>;
}
