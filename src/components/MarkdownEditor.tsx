/**
 * Markdown 编辑器组件
 * 使用 md-editor-rt
 * 参考 nnnnzs.cn/components/Post/Edit.vue
 */

'use client';

import React from 'react';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import '@/style/makrdownEditor.css';
import axios from 'axios';
import { message } from 'antd';

interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Markdown 编辑器组件
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '支持 Markdown 格式，可以直接粘贴图片...',
  className,
}: MarkdownEditorProps) {
  /**
   * 处理图片上传
   * 参考 nnnnzs.cn/components/Post/Edit.vue 的 onUploadImg
   */
  const onUploadImg = async (
    files: File[],
    callback: (urls: string[]) => void
  ) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('inputFile', file);

        const response = await axios.post<{
          status: boolean;
          data: string;
          message?: string;
        }>('/api/fs/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              // 可以在这里显示上传进度
              console.log(`上传进度: ${percent}%`);
            }
          },
        });

        if (response.data.status) {
          return response.data.data;
        } else {
          throw new Error(response.data.message || '上传失败');
        }
      });

      const urls = await Promise.all(uploadPromises);
      callback(urls);
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败');
      callback([]);
    }
  };

  return (
    <div className={`h-full custom-md-editor ${className}`}>
      <MdEditor
        modelValue={value}
        onChange={onChange}
        onUploadImg={onUploadImg}
        placeholder={placeholder}
        codeFoldable={false}
        previewTheme="cyanosis"
        language="zh-CN"
        toolbars={[
          'bold',
          'underline',
          'italic',
          '-',
          'title',
          'strikeThrough',
          'sub',
          'sup',
          'quote',
          'unorderedList',
          'orderedList',
          'task',
          '-',
          'codeRow',
          'code',
          'link',
          'image',
          'table',
          '-',
          'revoke',
          'next',
          'save',
          '=',
          'pageFullscreen',
          'fullscreen',
          'preview',
          'catalog',
        ]}
      />
    </div>
  );
}
