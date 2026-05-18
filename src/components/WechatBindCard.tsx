/**
 * 微信绑定卡片组件
 * 用于用户信息页面，显示微信绑定状态和操作
 */

'use client';

import React, { useState } from 'react';
import { Card, Button, Modal, message, Space, Typography, Divider } from 'antd';
import { WechatOutlined, DisconnectOutlined, LinkOutlined } from '@ant-design/icons';
import axios from 'axios';
import WechatQRLogin from '@/components/WechatQRLogin';

const { Text } = Typography;

interface WechatBindCardProps {
  /**
   * 是否已绑定微信
   */
  isBound: boolean;
  
  /**
   * 绑定/解绑成功回调
   */
  onStatusChange?: () => void;
}

/**
 * 微信绑定卡片组件
 */
export default function WechatBindCard({ isBound, onStatusChange }: WechatBindCardProps) {
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [unbindLoading, setUnbindLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>();

  /**
   * 显示绑定弹窗
   */
  const showBindModal = async () => {
    try {
      // 获取当前用户信息
      const response = await axios.get('/api/user/info');
      if (response.data.status && response.data.data) {
        setCurrentUserId(response.data.data.id);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
    setBindModalVisible(true);
  };

  /**
   * 关闭绑定弹窗
   */
  const closeBindModal = () => {
    setBindModalVisible(false);
  };

  /**
   * 微信扫码成功回调
   */
  const handleWechatScanSuccess = async (token: string, userInfo: Record<string, unknown>) => {
    try {
      // 如果 userInfo 中已经有错误信息，直接显示
      if (userInfo.status === false && userInfo.message) {
        message.error(userInfo.message as string);
        return;
      }

      // 调用绑定接口确认
      const response = await axios.post('/api/wechat/bind', { token });

      if (response.data.status) {
        message.success('绑定成功！');
        closeBindModal();

        // 通知父组件刷新数据
        if (onStatusChange) {
          onStatusChange();
        }
      } else {
        message.error(response.data.message || '绑定失败');
      }
    } catch (error) {
      console.error('绑定微信失败:', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('绑定微信失败，请重试');
      }
    }
  };

  /**
   * 微信扫码失败回调
   */
  const handleWechatScanError = (errorMessage: string) => {
    message.error(errorMessage);
  };

  /**
   * 解绑微信
   */
  const handleUnbind = () => {
    Modal.confirm({
      title: '确认解绑',
      content: '解绑后将无法使用微信扫码登录，确定要解绑吗？',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setUnbindLoading(true);
        try {
          const response = await axios.delete('/api/wechat/bind');
          
          if (response.data.status) {
            message.success('解绑成功！');
            
            // 通知父组件刷新数据
            if (onStatusChange) {
              onStatusChange();
            }
          } else {
            message.error(response.data.message || '解绑失败');
          }
        } catch (error) {
          console.error('解绑微信失败:', error);
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message.error(error.response.data.message);
          } else {
            message.error('解绑微信失败，请重试');
          }
        } finally {
          setUnbindLoading(false);
        }
      },
    });
  };

  return (
    <>
      <Card
        title={
          <Space>
            <WechatOutlined className="text-green-500" />
            <span>微信绑定</span>
          </Space>
        }
        className="w-full"
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <div className="flex items-center justify-between">
            <div>
              <Text strong>绑定状态</Text>
              <br />
              <Text type="secondary">
                {isBound ? '已绑定微信，可使用微信扫码登录' : '未绑定微信'}
              </Text>
            </div>
            <div>
              {isBound ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-green-600 dark:bg-green-900 dark:text-green-300">
                  已绑定
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  未绑定
                </span>
              )}
            </div>
          </div>

          <Divider className="my-2" />

          <div className="flex justify-end">
            {isBound ? (
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={handleUnbind}
                loading={unbindLoading}
              >
                解绑微信
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={showBindModal}
              >
                绑定微信
              </Button>
            )}
          </div>

          {!isBound && (
            <div className="rounded bg-blue-50 p-3 dark:bg-blue-900">
              <Text type="secondary" className="text-xs">
                💡 绑定微信后，可以使用微信扫码快速登录
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {/* 绑定弹窗 */}
      <Modal
        title="绑定微信"
        open={bindModalVisible}
        onCancel={closeBindModal}
        footer={null}
        width={500}
      >
        <div className="py-4">
          <WechatQRLogin
            onSuccess={handleWechatScanSuccess}
            onError={handleWechatScanError}
            env="trial"
            mode="bind"
            userId={currentUserId}
          />
        </div>
      </Modal>
    </>
  );
}
