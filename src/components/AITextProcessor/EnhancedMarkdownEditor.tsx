/**
 * 增强的Markdown编辑器
 * 在原有MarkdownEditor基础上集成AI文本处理功能
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import MarkdownEditor from '@/components/MarkdownEditor';
import AITextProcessor from './index';
import type { AIActionType } from '@/services/ai-text';

interface EnhancedMarkdownEditorProps {
  /** 编辑器值 */
  value: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** CSS类名 */
  className?: string;
  /** 是否显示预览区域 */
  preview?: boolean;
  /** 是否启用AI文本处理 */
  enableAITextProcess?: boolean;
  /** 可用的AI操作类型 */
  aiActions?: AIActionType[];
  /** AI文本长度限制 */
  aiMaxLength?: number;
}

/**
 * 增强的Markdown编辑器组件
 * 
 * 集成了AI文本处理功能，支持：
 * - 文本选择后显示悬浮菜单
 * - AI润色、扩写、缩写
 * - 实时流式处理
 * - 结果预览和确认
 * 
 * 使用示例：
 * ```tsx
 * <EnhancedMarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   enableAITextProcess={true}
 *   placeholder="开始写作..."
 * />
 * ```
 */
const EnhancedMarkdownEditor: React.FC<EnhancedMarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = '支持 Markdown 格式，可以直接粘贴图片...',
  className,
  preview = true,
  enableAITextProcess = true,
  aiActions = ['refine', 'expand', 'summarize'],
  aiMaxLength = 5000,
}) => {
  const [content, setContent] = useState(value);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 同步外部value变化到内部状态
  React.useEffect(() => {
    setContent(value);
  }, [value]);

  /**
   * 处理内容变化
   */
  const handleContentChange = useCallback((newValue: string) => {
    setContent(newValue);
    if (onChange) {
      onChange(newValue);
    }
  }, [onChange]);

  /**
   * AI处理后的更新回调
   */
  const handleAIContentChange = useCallback((newContent: string) => {
    handleContentChange(newContent);
  }, [handleContentChange]);

  return (
    <div 
      ref={editorContainerRef}
      className="enhanced-markdown-editor-container"
      style={{ position: 'relative' }}
    >
      {/* 原有的Markdown编辑器 */}
      <MarkdownEditor
        value={content}
        onChange={handleContentChange}
        placeholder={placeholder}
        className={className}
        preview={preview}
      />

      {/* AI文本处理组件 */}
      {enableAITextProcess && (
        <AITextProcessor
          content={content}
          onContentChange={handleAIContentChange}
          editorSelector=".md-editor-textarea"
          availableActions={aiActions}
          maxLength={aiMaxLength}
        />
      )}

      {/* 样式注入 - 确保编辑器支持文本选择 */}
      <style jsx>{`
        .enhanced-markdown-editor-container {
          position: relative;
        }
        
        /* 确保编辑器文本区域支持选择 */
        :global(.md-editor-textarea) {
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
        }
        
        /* 选中文本的高亮样式 */
        :global(.md-editor-textarea::selection) {
          background: rgba(24, 144, 255, 0.2) !important;
        }
        
        :global(.md-editor-textarea::-moz-selection) {
          background: rgba(24, 144, 255, 0.2) !important;
        }
      `}</style>
    </div>
  );
};

export default EnhancedMarkdownEditor;
export { default as AITextProcessor } from './index';
export type { AIActionType } from '@/services/ai-text';