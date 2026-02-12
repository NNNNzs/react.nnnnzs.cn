/**
 * Markdown 编辑器组件
 * 使用 md-editor-rt
 * 参考 nnnnzs.cn/components/Post/Edit.vue
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MdEditor, type MdEditorProps } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import '@/style/markdownEditor.css';
import axios from 'axios';
import { message } from 'antd';
import { useDarkMode } from '@/hooks/useDarkMode';

interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * 是否显示右侧预览区域（默认显示）
   * 在评论编辑等场景可以关闭，只保留编辑区域
   */
  preview?: boolean;
}

// 用于存储正在输入的中文，避免被截断
let isComposing = false;

/**
 * Markdown 编辑器组件
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '支持 Markdown 格式，可以直接粘贴图片...',
  className,
  preview = true,
}: MarkdownEditorProps) {
  // 获取暗色模式状态
  const { isDark } = useDarkMode();

  // 编辑器 ref
  const editorRef = useRef<any>(null);

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

  /**
   * 处理中文输入法开始
   */
  const handleCompositionStart = useCallback(() => {
    isComposing = true;
  }, []);

  /**
   * 处理中文输入法结束
   */
  const handleCompositionEnd = useCallback((e: any) => {
    // 等待一下确保输入完成
    setTimeout(() => {
      isComposing = false;
      // 触发 onChange 更新父组件
      const textarea = editorRef.current?.querySelector?.('textarea.md-editor-textarea');
      if (textarea) {
        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);
      }
    }, 0);
  }, []);

  /**
   * 处理编辑器内容变化
   * 处理中文输入法：等待 composition 结束
   */
  const handleChange = useCallback((val: string) => {
    // 只有在非中文输入状态下才更新值
    if (!isComposing) {
      onChange?.(val);
    }
  }, [onChange]);

  return (
    <div className={`h-full custom-md-editor ${className}`}>
      <MdEditor
        ref={editorRef}
        modelValue={value}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        preview={preview ?? true}
        onUploadImg={onUploadImg}
        placeholder={placeholder}
        theme={isDark ? "dark" : "light"}
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
