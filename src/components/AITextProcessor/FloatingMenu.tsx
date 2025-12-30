/**
 * AI文本处理悬浮菜单组件
 * 显示在选中文本上方，提供AI处理选项
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Tooltip } from 'antd';
import { 
  EditOutlined, 
  ExpandOutlined, 
  CompressOutlined, 
  CloseOutlined 
} from '@ant-design/icons';
import type { AIActionType } from '@/lib/ai-text';
import { getAIActionLabel } from '@/lib/ai-text';

interface FloatingMenuProps {
  /** 选区坐标信息 */
  selectionRect: DOMRect;
  /** 处理回调 */
  onAction: (action: AIActionType) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 可用的操作类型 */
  availableActions?: AIActionType[];
}

/**
 * 悬浮菜单组件
 */
const FloatingMenu: React.FC<FloatingMenuProps> = ({
  selectionRect,
  onAction,
  onCancel,
  availableActions = ['refine', 'expand', 'summarize'],
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  // 操作按钮配置
  const actionButtons = {
    refine: {
      icon: <EditOutlined />,
      color: '#1890ff',
      tooltip: '润色文本，提升表达质量',
    },
    expand: {
      icon: <ExpandOutlined />,
      color: '#52c41a',
      tooltip: '扩写文本，增加细节描述',
    },
    summarize: {
      icon: <CompressOutlined />,
      color: '#faad14',
      tooltip: '缩写文本，保留核心信息',
    },
  };

  // 计算菜单位置
  const calculatePosition = useCallback(() => {
    if (!selectionRect) return;

    const menuWidth = 320; // 菜单预估宽度
    const menuHeight = 50; // 菜单高度
    const offset = 10; // 与选区的间距

    // 计算顶部位置（选区上方）
    let top = selectionRect.top - menuHeight - offset;
    
    // 如果上方空间不足，放到下方
    if (top < 10) {
      top = selectionRect.bottom + offset;
    }

    // 计算左侧位置（选区中心）
    let left = selectionRect.left + (selectionRect.width / 2) - (menuWidth / 2);

    // 边界检查：确保不超出视口
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 左边界
    if (left < 10) {
      left = 10;
    }
    // 右边界
    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10;
    }

    // 上边界（如果在上方）
    if (top < 10 && selectionRect.top > viewportHeight / 2) {
      top = selectionRect.bottom + offset;
    }

    setPosition({ top, left });
    setIsVisible(true);
  }, [selectionRect]);

  useEffect(() => {
    calculatePosition();
  }, [calculatePosition]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // ESC键关闭
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // 延迟添加事件监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  if (!isVisible || !selectionRect) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
      }}
      className="ai-floating-menu"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* AI操作按钮 */}
        {availableActions.map((action) => {
          const config = actionButtons[action];
          return (
            <Tooltip key={action} title={config.tooltip} placement="top">
              <Button
                type="text"
                size="small"
                icon={config.icon}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(action);
                }}
                style={{
                  color: config.color,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {getAIActionLabel(action)}
              </Button>
            </Tooltip>
          );
        })}

        {/* 分隔线 */}
        <div
          style={{
            width: '1px',
            height: '20px',
            background: 'rgba(0, 0, 0, 0.1)',
            margin: '0 4px',
          }}
        />

        {/* 取消按钮 */}
        <Tooltip title="取消" placement="top">
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            style={{
              color: 'rgba(0, 0, 0, 0.65)',
            }}
          />
        </Tooltip>
      </div>

      {/* 小三角指示器 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          // 根据位置决定三角形方向
          ...(position.top < selectionRect.top 
            ? { top: '100%', borderTop: '6px solid rgba(255, 255, 255, 0.95)' }
            : { bottom: '100%', borderBottom: '6px solid rgba(255, 255, 255, 0.95)' }
          ),
        }}
      />
    </div>
  );
};

export default FloatingMenu;