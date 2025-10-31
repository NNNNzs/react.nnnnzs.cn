/**
 * 编辑文章页
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Card,
  Spin,
} from 'antd';
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import type { Post } from '@/types';

const { TextArea } = Input;

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);

  const isNewPost = params.id === 'new';

  /**
   * 检查权限
   */
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/c/edit/${params.id}`);
    }
  }, [user, authLoading, router, params.id]);

  /**
   * 加载文章数据
   */
  const loadPost = async () => {
    if (isNewPost) {
      setFetchLoading(false);
      return;
    }
    
    try {
      setFetchLoading(true);
      const response = await axios.get(`/api/post/${params.id}`);
      if (response.data.status) {
        const postData = response.data.data;
        setPost(postData);
        form.setFieldsValue(postData);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
      message.error('加载文章失败');
    } finally {
      setFetchLoading(false);
    }
  };

  /**
   * 提交表单
   */
  interface EditFormValues {
    title: string;
    description: string;
    tags: string;
    cover?: string;
    category?: string;
    content: string;
    hide: string;
  }

  const handleSubmit = async (values: EditFormValues) => {
    try {
      setLoading(true);
      
      if (isNewPost) {
        // 创建新文章
        await axios.post('/api/post/create', values);
        message.success('创建成功');
      } else {
        // 更新现有文章
        await axios.put(`/api/post/${params.id}`, values);
        message.success('保存成功');
      }
      
      router.push('/c');
    } catch (error) {
      console.error('操作失败:', error);
      message.error(isNewPost ? '创建失败' : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPost();
    }
  }, [user, params.id]);

  if (authLoading || fetchLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!user || (!post && !isNewPost)) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card
        title={
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{isNewPost ? '创建文章' : '编辑文章'}</h1>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => router.push('/c')}
            >
              返回
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入文章标题" size="large" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea
              placeholder="请输入文章描述"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="标签"
            name="tags"
            rules={[{ required: true, message: '请输入标签' }]}
            extra="多个标签用逗号分隔"
          >
            <Input placeholder="例如: JavaScript,React,Next.js" />
          </Form.Item>

          <Form.Item
            label="封面图片URL"
            name="cover"
          >
            <Input placeholder="请输入封面图片URL" />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
          >
            <Input placeholder="请输入分类" />
          </Form.Item>

          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea
              placeholder="支持Markdown格式"
              rows={20}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="状态"
            name="hide"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="0">显示</Select.Option>
              <Select.Option value="1">隐藏</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

