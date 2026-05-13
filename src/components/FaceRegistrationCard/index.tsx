/**
 * 人脸识别注册卡片组件
 * 自行管理注册状态，通过 /api/face/status 获取真实状态
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, Button, Space, Typography, Modal, message } from 'antd';
import { ScanOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';

// face-api 依赖浏览器 API，必须禁用 SSR
const FaceCamera = dynamic(() => import('@/components/FaceCamera'), { ssr: false });

const { Title, Text } = Typography;

interface FaceRegistrationCardProps {
  onStatusChange?: () => void;
}

export default function FaceRegistrationCard({
  onStatusChange,
}: FaceRegistrationCardProps) {
  const [registered, setRegistered] = useState(false);
  const [checking, setChecking] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/face/status');
      if (res.data.status) {
        setRegistered(res.data.data.registered);
      }
    } catch {
      // 未登录等异常忽略
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleOpenModal = () => {
    setCaptured(null);
    setModalOpen(true);
  };

  const handleCapture = (base64: string) => {
    setCaptured(base64);
  };

  const handleConfirmRegister = async () => {
    if (!captured) {
      message.warning('请先拍照');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/face/register', { image: captured });
      if (res.data.status) {
        message.success('人脸注册成功');
        setModalOpen(false);
        setRegistered(true);
        onStatusChange?.();
      } else {
        message.error(res.data.message || '注册失败');
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : '注册失败';
      message.error(msg || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await axios.delete('/api/face/register');
      if (res.data.status) {
        message.success('人脸注册已删除');
        setRegistered(false);
        onStatusChange?.();
      } else {
        message.error(res.data.message || '删除失败');
      }
    } catch {
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <div className="py-4 text-center text-gray-400">加载中...</div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Space direction="vertical" size="middle" className="w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <ScanOutlined className="text-xl text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <Title level={4} style={{ marginBottom: 0 }}>
                人脸识别登录
              </Title>
              <Text type="secondary">{registered ? '已注册' : '未注册'}</Text>
            </div>
          </div>

          {registered ? (
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <Space direction="vertical" size="small" className="w-full">
                <div className="flex items-center gap-2">
                  <SafetyCertificateOutlined className="text-green-600" />
                  <Text strong>人脸识别登录已开启</Text>
                </div>
                <Text type="secondary">您可以在登录页面使用人脸识别快速登录</Text>
                <div className="flex gap-2 pt-2">
                  <Button icon={<ScanOutlined />} onClick={handleOpenModal}>
                    更新人脸照片
                  </Button>
                  <Button danger icon={<DeleteOutlined />} onClick={handleDelete} loading={loading}>
                    关闭人脸登录
                  </Button>
                </div>
              </Space>
            </div>
          ) : (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <Space direction="vertical" size="small" className="w-full">
                <Text>开启人脸识别登录后可以：</Text>
                <ul className="ml-4 space-y-1">
                  <li>
                    <Text type="secondary">• 在登录页通过摄像头拍照快速登录</Text>
                  </li>
                  <li>
                    <Text type="secondary">• 无需输入账号密码</Text>
                  </li>
                </ul>
                <Button
                  type="primary"
                  icon={<ScanOutlined />}
                  onClick={handleOpenModal}
                  className="mt-2"
                >
                  开启人脸登录
                </Button>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      <Modal
        title={registered ? '更新人脸照片' : '注册人脸'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              onClick={handleConfirmRegister}
              loading={loading}
              disabled={!captured}
            >
              确认注册
            </Button>
          </div>
        }
        width={420}
        centered
      >
        <div className="flex flex-col items-center py-4">
          <FaceCamera onCapture={handleCapture} width={300} height={300} />
          {captured && (
            <Text type="secondary" className="mt-2">
              照片已拍摄，点击「确认注册」完成{registered ? '更新' : '注册'}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
}
