/**
 * AI文本处理插件 - 主入口
 * 
 * 提供完整的AI文本处理功能：
 * - 文本选择检测
 * - 悬浮菜单
 * - AI处理（润色、扩写、缩写）
 * - 流式响应
 * - 结果预览和确认
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import type { AIActionType } from '@/services/ai-text';
import { validateTextForAI } from '@/services/ai-text';
import FloatingMenu from './FloatingMenu';
import ProcessingModal from './ProcessingModal';

export interface AITextProcessorProps {
  /** 编辑器内容 */
  content: string;
  /** 内容更新回调 */
  onContentChange: (newContent: string) => void;
  /** 编辑器容器选择器（用于定位选区） */
  editorSelector?: string;
  /** 可用的操作类型 */
  availableActions?: AIActionType[];
  /** 最大文本长度限制 */
  maxLength?: number;
}

/**
 * AI文本处理主组件
 * 
 * 使用方式：
 * 1. 在编辑器组件中引入此组件
 * 2. 传入当前内容和更新回调
 * 3. 组件会自动监听文本选择并显示悬浮菜单
 * 
 * 示例：
 * ```tsx
 * <AITextProcessor
 *   content={editorContent}
 *   onContentChange={setEditorContent}
 *   editorSelector=".md-editor-textarea"
 * />
 * ```
 */
const AITextProcessor: React.FC<AITextProcessorProps> = ({
  content,
  onContentChange,
  editorSelector = '.md-editor-textarea',
  availableActions = ['refine', 'expand', 'summarize'],
  maxLength = 5000,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);
  
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 获取选中的文本和位置信息
   */
  const getSelectionInfo = useCallback((): { text: string; rect: DOMRect | null } => {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      return { text: '', rect: null };
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();

    if (!selectedText) {
      return { text: '', rect: null };
    }

    // 检查选区是否在编辑器内
    const editorElement = document.querySelector(editorSelector);
    if (!editorElement) {
      return { text: '', rect: null };
    }

    // 获取选区的起始和结束容器节点
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    // 辅助函数：检查节点是否在编辑器内
    const isNodeInEditor = (node: Node): boolean => {
      // 如果是元素节点，直接检查
      if (node.nodeType === Node.ELEMENT_NODE) {
        return editorElement.contains(node);
      }
      // 如果是文本节点，检查其父元素
      if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
        return editorElement.contains(node.parentElement);
      }
      return false;
    };

    // 检查起始和结束节点是否都在编辑器内
    if (!isNodeInEditor(startContainer) || !isNodeInEditor(endContainer)) {
      return { text: '', rect: null };
    }

    // 额外检查：确保 commonAncestorContainer 也在编辑器内
    const commonAncestor = range.commonAncestorContainer;
    if (!isNodeInEditor(commonAncestor)) {
      return { text: '', rect: null };
    }

    // 获取选区坐标
    const rect = range.getBoundingClientRect();

    // 验证选区坐标是否有效（避免选区在编辑器外但节点检查通过的情况）
    if (rect.width === 0 && rect.height === 0) {
      return { text: '', rect: null };
    }

    return { text: selectedText, rect };
  }, [editorSelector]);

  /**
   * 处理文本选择事件
   */
  const handleSelection = useCallback((event?: Event) => {
    // 如果提供了事件对象，先检查事件目标是否在编辑器内
    if (event && event.target) {
      const editorElement = document.querySelector(editorSelector);
      if (editorElement) {
        const target = event.target as Node;
        // 检查事件目标或其父元素是否在编辑器内
        if (!editorElement.contains(target)) {
          // 如果当前显示菜单，且选择不在编辑器内，则隐藏菜单
          if (showMenu) {
            setShowMenu(false);
          }
          return;
        }
      }
    }

    // 清除之前的定时器
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    // 延迟处理，确保选择完成
    selectionTimeoutRef.current = setTimeout(() => {
      const { text, rect } = getSelectionInfo();

      if (text && rect) {
        // 验证文本
        const validation = validateTextForAI(text);
        if (!validation.valid) {
          if (showMenu) {
            setShowMenu(false);
          }
          if (validation.reason) {
            message.warning(validation.reason);
          }
          return;
        }

        // 检查长度限制
        if (text.length > maxLength) {
          message.warning(`文本长度超过限制（${maxLength}字符）`);
          setShowMenu(false);
          return;
        }

        setSelectedText(text);
        setSelectionRect(rect);
        setShowMenu(true);
      } else {
        setShowMenu(false);
      }
    }, 150); // 150ms 延迟
  }, [getSelectionInfo, maxLength, showMenu, editorSelector]);

  /**
   * 处理AI操作
   */
  const handleAIAction = useCallback((action: AIActionType) => {
    if (!selectedText) {
      message.warning('请先选择要处理的文本');
      return;
    }

    setCurrentAction(action);
    setShowMenu(false);
    setShowModal(true);
  }, [selectedText]);

  /**
   * 处理AI结果确认
   */
  const handleConfirm = useCallback((result: string) => {
    if (!selectedText || !currentAction) {
      message.warning('操作状态异常，请重试');
      setShowModal(false);
      return;
    }

    try {
      // 在内容中替换选中的文本
      const newContent = content.replace(selectedText, result);
      
      // 验证替换是否成功
      if (newContent === content) {
        message.error('文本替换失败，可能是因为原文本在内容中不存在');
        return;
      }

      onContentChange(newContent);
      message.success('AI处理完成，文本已更新');
      
      // 清除选区
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      setShowModal(false);
      setSelectedText('');
      setCurrentAction(null);
    } catch (error) {
      console.error('替换文本失败:', error);
      message.error('文本替换失败');
    }
  }, [content, selectedText, currentAction, onContentChange]);

  /**
   * 处理取消
   */
  const handleCancel = useCallback(() => {
    setShowMenu(false);
    setShowModal(false);
    setSelectedText('');
    setCurrentAction(null);
    
    // 清除选区
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  /**
   * 监听文本选择事件
   */
  useEffect(() => {
    // 包装事件处理函数，传递事件对象
    const handleMouseUp = (e: MouseEvent) => handleSelection(e);
    const handleKeyUp = (e: KeyboardEvent) => handleSelection(e);

    // 使用捕获阶段，确保能捕获到选择事件
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      
      // 清理定时器
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [handleSelection]);

  /**
   * 监听窗口大小变化，重新计算位置
   */
  useEffect(() => {
    const handleResize = () => {
      if (showMenu && selectionRect) {
        // 重新获取选区信息
        const { text, rect } = getSelectionInfo();
        if (text && rect) {
          setSelectionRect(rect);
        } else {
          setShowMenu(false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showMenu, selectionRect, getSelectionInfo]);

  /**
   * 监听滚动事件，隐藏菜单
   */
  useEffect(() => {
    const handleScroll = () => {
      if (showMenu) {
        // 延迟隐藏，避免滚动时闪烁
        setTimeout(() => {
          const { text } = getSelectionInfo();
          if (!text) {
            setShowMenu(false);
          }
        }, 100);
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [showMenu, getSelectionInfo]);

  return (
    <>
      {/* 悬浮菜单 */}
      {showMenu && selectionRect && (
        <FloatingMenu
          selectionRect={selectionRect}
          onAction={handleAIAction}
          onCancel={handleCancel}
          availableActions={availableActions}
        />
      )}

      {/* 处理弹窗 */}
      {showModal && currentAction && (
        <ProcessingModal
          open={showModal}
          originalText={selectedText}
          action={currentAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* 隐藏的容器，用于组件生命周期管理 */}
      <div ref={containerRef} style={{ display: 'none' }} />
    </>
  );
};

export default AITextProcessor;
export { default as EnhancedMarkdownEditor } from './EnhancedMarkdownEditor';
export { default as FloatingMenu } from './FloatingMenu';
export { default as ProcessingModal } from './ProcessingModal';
export type { AIActionType } from '@/services/ai-text';
export { getAIActionLabel, getAIActionIcon, validateTextForAI } from '@/services/ai-text';