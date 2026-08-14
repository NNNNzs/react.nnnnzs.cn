'use client';

import { useState } from 'react';
import { Button, Dropdown } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ContentDraftPreviewMode } from '@/types/content-draft-preview';

const previewOptions: Array<{ key: ContentDraftPreviewMode; label: string }> = [
  { key: 'xhs', label: '小红书预览' },
  { key: 'zhihu', label: '知乎预览' },
  { key: 'toutiao', label: '今日头条预览' },
];

export function DraftPreviewActions({
  previewUrl, hasChanges, onSave,
}: {
  previewUrl: string;
  hasChanges: boolean;
  onSave: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  const openPreview = async (mode: ContentDraftPreviewMode) => {
    if (hasChanges && !(await onSave())) return;
    const url = new URL(previewUrl, window.location.origin);
    url.searchParams.set('mode', mode);
    if (window.matchMedia('(max-width: 767px)').matches) window.location.assign(url.toString());
    else window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <Dropdown
      open={open}
      trigger={['hover', 'click']}
      onOpenChange={setOpen}
      destroyOnHidden
      menu={{
        items: previewOptions,
        onClick: ({ key }) => {
          setOpen(false);
          void openPreview(key as ContentDraftPreviewMode);
        },
      }}
    >
      <Button icon={<EyeOutlined />}>{hasChanges ? '保存并预览' : '预览'}</Button>
    </Dropdown>
  );
}
