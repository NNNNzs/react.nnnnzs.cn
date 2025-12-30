/**
 * AI处理弹窗组件
 * 显示原始文本和AI生成结果，支持预览和确认
 * 默认使用流式响应
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Spin, Space, message, Alert } from 'antd';
import { CheckOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import type { AIActionType } from '@/lib/ai-text';
import { getAIActionLabel, callAIAPI } from '@/lib/ai-text';

interface ProcessingModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 原始文本 */
  originalText: string;
  /** AI操作类型 */
  action: AIActionType;
  /** 处理完成回调（确认） */
  onConfirm: (result: string) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * AI处理弹窗组件
 */
const ProcessingModal: React.FC<ProcessingModalProps> = ({
  open,
  originalText,
  action,
  onConfirm,
  onCancel,
}) => {
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState(''); // 流式文本
  const abortControllerRef = useRef<AbortController | null>(null);

  // 重置状态
  const resetState = () => {
    setResult('');
    setStreamText('');
    setError(null);
    setIsLoading(false);
  };

  /**
   * 调用AI处理文本（流式）
   */
  const processText = useCallback(async () => {
    if (!originalText || !action) return;

    setIsLoading(true);
    setError(null);
    setStreamText('');

    try {
      // 调用API（流式）
      const response = await callAIAPI({
        text: originalText,
        action: action,
      });

      // 流式处理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamText(fullText);
      }

      // 完成后设置最终结果
      setResult(fullText);
      setIsLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户取消，不显示错误
        return;
      }
      
      console.error('AI处理失败:', err);
      const errorMessage = err instanceof Error ? err.message : 'AI处理失败';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [originalText, action]);

  // 处理打开弹窗
  useEffect(() => {
    if (open && originalText) {
      resetState();
      // 延迟执行，确保状态重置完成
      setTimeout(() => {
        processText();
      }, 100);
    }
  }, [open, originalText, action, processText]);

  // 处理关闭弹窗
  useEffect(() => {
    if (!open) {
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      resetState();
    }
  }, [open]);

  /**
   * 确认使用AI结果
   */
  const handleConfirm = () => {
    const finalResult = result || streamText;
    if (finalResult.trim()) {
      onConfirm(finalResult);
    } else {
      message.warning('没有可使用的结果');
    }
  };

  /**
   * 取消并重试
   */
  const handleRetry = () => {
    setError(null);
    processText();
  };

  // 当前显示的文本（流式或最终结果）
  const displayText = result || streamText;

  return (
    <Modal
      title={
        <Space>
          <span>AI{getAIActionLabel(action)}</span>
          {isLoading && <Spin indicator={<LoadingOutlined spin />} size="small" />}
        </Space>
      }
      open={open}
      width={900}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} icon={<CloseOutlined />}>
          取消
        </Button>,
        <Button 
          key="retry" 
          onClick={handleRetry} 
          disabled={!error && !isLoading}
          style={{ display: error ? 'inline-flex' : 'none' }}
        >
          重试
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={isLoading || !displayText.trim()}
          icon={<CheckOutlined />}
        >
          确认使用
        </Button>,
      ]}
      maskClosable={!isLoading}
      confirmLoading={isLoading}
      destroyOnClose
    >
      <div style={{ display: 'flex', gap: '16px', height: '400px' }}>
        {/* 左侧：原始文本 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', fontWeight: 500, color: 'rgba(0,0,0,0.65)' }}>
            原始文本
          </div>
          <div
            style={{
              flex: 1,
              padding: '12px',
              background: '#fafafa',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              overflow: 'auto',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {originalText}
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', background: '#f0f0f0' }} />

        {/* 右侧：AI结果 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', fontWeight: 500, color: 'rgba(0,0,0,0.65)' }}>
            AI生成结果
          </div>
          <div
            style={{
              flex: 1,
              padding: '12px',
              background: '#f6ffed',
              borderRadius: '6px',
              border: '1px solid #b7eb8f',
              overflow: 'auto',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              position: 'relative',
            }}
          >
            {isLoading && !displayText && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#52c41a' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <div style={{ marginTop: '8px' }}>AI正在思考中...</div>
              </div>
            )}

            {error && (
              <Alert
                message="处理失败"
                description={error}
                type="error"
                showIcon
                style={{ marginBottom: '8px' }}
              />
            )}

            {displayText && (
              <div style={{ color: '#52c41a', minHeight: '100%' }}>
                {displayText}
                {/* 光标效果 */}
                {isLoading && (
                  <span style={{ animation: 'blink 1s infinite', marginLeft: '2px' }}>▋</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
        <Space direction="vertical" size={2}>
          <div>• 支持实时流式返回，结果会逐步显示</div>
          <div>• 点击“确认使用”将替换编辑器中的选中文本</div>
          <div>• 处理过程中可以点击“取消”终止请求</div>
        </Space>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </Modal>
  );
};

export default ProcessingModal;
