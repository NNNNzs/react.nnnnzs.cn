/**
 * 编辑文章页
 * 参考 Edit.vue 的布局和功能
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Spin,
  DatePicker,
  InputNumber,
  Radio,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import type { Post } from '@/types';
import MarkdownEditor from '@/components/MarkdownEditor';

/**
 * 生成文章路径 - 已移至服务端
 */
// function genPath... removed


export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [tags, setTags] = useState<[string, number][]>([]);
  const [tagsString, setTagsString] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

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
   * 加载标签列表
   */
  const loadTags = async () => {
    try {
      const response = await axios.get('/api/post/tags');
      if (response.data.status) {
        const tagList = response.data.data.filter((e: [string, number]) => e[0]);
        setTags(tagList);
      }
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };

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
        
        // 设置表单值
        form.setFieldsValue({
          ...postData,
          date: postData.date ? dayjs(postData.date) : dayjs(),
          updated: postData.updated ? dayjs(postData.updated) : dayjs(),
        });
        
        // 设置标签
        if (postData.tags) {
          setTagsString(postData.tags.split(',').filter(Boolean));
        }
      }
    } catch (error) {
      console.error('加载文章失败:', error);
      message.error('加载文章失败');
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTags();
      loadPost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  /**
   * 生成描述
   * 参考 nnnnzs.cn/components/Post/Edit.vue 的 genDescription
   */
  const genDescription = () => {
    const preview = previewRef.current;
    if (preview) {
      const text = preview.textContent || '';
      const description = text.substring(0, 77) + '...';
      form.setFieldsValue({ description });
    } else {
      // 从 markdown 内容中提取纯文本
      const content = form.getFieldValue('content') || '';
      const text = content
        .replace(/```[\s\S]*?```/g, '') // 移除代码块
        .replace(/`[^`]+`/g, '') // 移除行内代码
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 移除链接，保留文本
        .replace(/[#*_~]/g, '') // 移除 markdown 标记
        .replace(/\n+/g, ' ') // 替换换行为空格
        .trim();
      const description = text.substring(0, 77) + '...';
      form.setFieldsValue({ description });
    }
  };

  /**
   * 生成背景图
   */
  const genCover = () => {
    const date = form.getFieldValue('date') || dayjs();
    const dateStr = dayjs(date).format('YYYYMMDD');
    const cover = `https://static.nnnnzs.cn/bing/${dateStr}.png`;
    form.setFieldsValue({ cover });
  };

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 生成路径 - 已移至服务端
      // const { path, oldTitle } = genPath({
      //   title: values.title,
      //   date: values.date,
      // });

      // 处理标签
      const tagsStr = tagsString.join(',');

      const postData = {
        ...values,
        // path,
        // oldTitle,
        tags: tagsStr,
        date: dayjs(values.date).format('YYYY-MM-DD HH:mm:ss'),
        updated: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        visitors: values.visitors || 0,
        likes: values.likes || 0,
      };

      if (isNewPost) {
        // 创建新文章
        const response = await axios.post('/api/post/create', postData);
        if (response.data.status) {
          message.success('创建成功');
          const newId = response.data.data.id;
          router.replace(`/c/edit/${newId}`);
        }
      } else {
        // 更新现有文章
        await axios.put(`/api/post/${params.id}`, postData);
        message.success('保存成功');
        loadPost();
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // 表单验证错误
        return;
      }
      console.error('操作失败:', error);
      message.error(isNewPost ? '创建失败' : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || fetchLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!user || (!post && !isNewPost)) {
    return null;
  }

  return (
    <div className="w-screen h-screen overflow-y-auto p-2 editor flex flex-col">
      <Form
        form={form}
        layout="inline"
        className="form"
        initialValues={{
          date: dayjs(),
          updated: dayjs(),
          hide: '1',
          visitors: 0,
          likes: 0,
        }}
      >
        <div className="flex justify-between w-full mb-2">
          <Form.Item
            className="flex-1"
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入文章标题" />
          </Form.Item>

          <Form.Item className="flex-1" label="标签" name="tagsString">
            <Select
              mode="tags"
              value={tagsString}
              onChange={setTagsString}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={tags.map((tag) => ({
                value: tag[0],
                label: tag[0],
              }))}
              placeholder="选择或输入标签"
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            className="flex-1"
            label="发布日期"
            name="date"
            rules={[{ required: true }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              className="w-full"
            />
          </Form.Item>

          <Form.Item className="flex-1" label="更新日期" name="updated">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              disabled
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            className="flex-1"
            label="发布"
            name="hide"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="0">是</Radio>
              <Radio value="1">否</Radio>
            </Radio.Group>
          </Form.Item>
        </div>

        <div className="flex flex-row justify-between w-full mb-2">
          <Form.Item className="flex-1" label="描述" name="description">
            <Input placeholder="请输入文章描述" />
          </Form.Item>

          <Form.Item className="flex-1" label="背景图" name="cover">
            <Input style={{ width: 320 }} placeholder="请输入背景图URL" />
          </Form.Item>

          <Form.Item className="flex-1" label="访客数" name="visitors">
            <InputNumber
              min={0}
              className="w-full"
            />
          </Form.Item>

          <Form.Item className="flex-1" label="点赞" name="likes">
            <InputNumber
              min={0}
              className="w-full"
            />
          </Form.Item>

          <Form.Item>
            <Button onClick={genDescription} className="mr-2">
              生成描述
            </Button>
            <Button onClick={genCover} className="mr-2">
              生成背景
            </Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </div>
      </Form>

      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <Form.Item name="content" rules={[{ required: true, message: '请输入内容' }]} className="h-full">
          <div className="h-full">
            <MarkdownEditor
              value={form.getFieldValue('content') || ''}
              onChange={(value) => {
                form.setFieldsValue({ content: value });
                // 更新预览区域用于生成描述
                if (previewRef.current) {
                  previewRef.current.innerHTML = value
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/`[^`]+`/g, '')
                    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                    .replace(/[#*_~]/g, '')
                    .replace(/\n+/g, ' ');
                }
              }}
              placeholder="支持 Markdown 格式，可以直接粘贴图片..."
            />
          </div>
        </Form.Item>
        {/* 隐藏的预览区域，用于生成描述 */}
        <div ref={previewRef} id="md-editor-v3-preview" className="hidden" />
      </div>
    </div>
  );
}

