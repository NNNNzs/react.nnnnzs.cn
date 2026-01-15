/**
 * 合集编辑页面 - 仅编辑基本信息
 * 路由: /c/collections/[id]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Form, Input, Button, Card, message, Space, Spin, Alert } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, UnorderedListOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import type { SerializedCollection } from '@/dto/collection.dto';

const { TextArea } = Input;

export default function CollectionEditPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // 加载合集数据（编辑模式）
  useEffect(() => {
    if (collectionId && collectionId !== 'new' && user) {
      setIsEdit(true);
      fetchCollection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, user]);

  const fetchCollection = async () => {
    if (collectionId === 'new') return;

    setFetching(true);
    try {
      const res = await axios.get(`/api/collections?pageSize=100&pageNum=1&status=all`);

      if (res.data.status) {
        const collection = res.data.data.record.find(
          (c: SerializedCollection) => c.id === parseInt(collectionId, 10)
        );

        if (collection) {
          form.setFieldsValue(collection);
        } else {
          message.error('合集不存在');
          router.push('/c/collections');
        }
      } else {
        message.error('获取合集信息失败');
      }
    } catch (error) {
      console.error('获取合集信息失败:', error);
      message.error('获取合集信息失败');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (values: {
    title: string;
    slug: string;
    description?: string;
    cover?: string;
    background?: string;
    color?: string;
  }) => {
    if (!user) {
      message.warning('请先登录');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        // 更新合集
        const res = await axios.put(`/api/collection/${collectionId}`, values);

        if (res.data.status) {
          message.success('更新成功');
          router.push('/c/collections');
        } else {
          message.error(res.data.message || '更新失败');
        }
      } else {
        // 创建合集
        const res = await axios.post('/api/collection/create', values);

        if (res.data.status) {
          message.success('创建成功');
          // 创建成功后跳转到管理页面
          router.push('/c/collections');
        } else {
          message.error(res.data.message || '创建失败');
        }
      }
    } catch (error: unknown) {
      console.error('保存合集失败:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        message.error(axiosError.response?.data?.message || '保存失败');
      } else {
        message.error('保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full py-6">
          <Card
            title={
              <Space>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => router.push('/c/collections')}
                >
                  返回
                </Button>
                <span>{isEdit ? '编辑合集' : '创建合集'}</span>
              </Space>
            }
          >
            {isEdit && (
              <Alert
                message="提示"
                description={
                  <div>
                    合集创建成功后，您可以点击右侧的&ldquo;管理文章&rdquo;按钮来添加或移除文章。
                  </div>
                }
                type="info"
                showIcon
                className="mb-4"
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
            >
              <Form.Item
                label="合集标题"
                name="title"
                rules={[
                  { required: true, message: '请输入合集标题' },
                  { max: 255, message: '标题不能超过255个字符' },
                ]}
              >
                <Input placeholder="请输入合集标题" />
              </Form.Item>

              <Form.Item
                label="URL Slug"
                name="slug"
                rules={[
                  { required: true, message: '请输入 Slug' },
                  {
                    pattern: /^[a-z0-9-]+$/,
                    message: 'Slug 只能包含小写字母、数字和连字符',
                  },
                ]}
              >
                <Input placeholder="例如: nextjs-series" />
              </Form.Item>

              <Form.Item
                label="合集描述"
                name="description"
                rules={[{ max: 1000, message: '描述不能超过1000个字符' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="请输入合集描述（支持 Markdown）"
                />
              </Form.Item>

              <Form.Item
                label="封面图 URL"
                name="cover"
                rules={[{ type: 'url', message: '请输入有效的 URL' }]}
              >
                <Input placeholder="https://example.com/cover.jpg" />
              </Form.Item>

              <Form.Item label="背景图 URL" name="background">
                <Input placeholder="https://example.com/background.jpg" />
              </Form.Item>

              <Form.Item
                label="主题色"
                name="color"
                rules={[
                  {
                    pattern: /^#[0-9A-Fa-f]{6}$/,
                    message: '颜色必须是十六进制格式，如 #2563eb',
                  },
                ]}
              >
                <Input placeholder="#2563eb" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    {isEdit ? '保存修改' : '创建合集'}
                  </Button>

                  {isEdit && (
                    <Button
                      icon={<UnorderedListOutlined />}
                      onClick={() => router.push(`/c/collections/${collectionId}/posts`)}
                    >
                      管理文章
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
