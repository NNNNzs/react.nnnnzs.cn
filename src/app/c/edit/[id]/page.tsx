/**
 * 编辑文章页
 * 参考 Edit.vue 的布局和功能
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Row,
  Col,
  Space,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import type { Post } from "@/types";
import MarkdownEditor from "@/components/MarkdownEditor";
import { fetchAndProcessStream } from "@/lib/stream";
// import EnhancedMarkdownEditor from "@/components/AITextProcessor/EnhancedMarkdownEditor";

/**
 * 生成文章路径 - 已移至服务端
 */
// function genPath... removed

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [form] = Form.useForm();
  // 统一的loading状态管理
  const [loading, setLoading] = useState({
    submit: false, // 提交表单
    generateDescription: false, // 生成描述
    fetch: true, // 加载文章数据
  });
  const [post, setPost] = useState<Post | null>(null);
  const [tags, setTags] = useState<[string, number][]>([]);

  const isNewPost = params.id === "new";

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
      const response = await axios.get("/api/post/tags");
      if (response.data.status) {
        const tagList = response.data.data.filter(
          (e: [string, number]) => e[0]
        );
        setTags(tagList);
      }
    } catch (error) {
      console.error("加载标签失败:", error);
    }
  };

  /**
   * 加载文章数据
   */
  const loadPost = async () => {
    if (isNewPost) {
      setLoading((prev) => ({ ...prev, fetch: false }));
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, fetch: true }));
      const response = await axios.get(`/api/post/${params.id}`);
      if (response.data.status) {
        const postData = response.data.data;
        setPost(postData);

        // 设置表单值
        form.setFieldsValue({
          ...postData,
          tags: postData.tags || [],
          date: postData.date ? dayjs(postData.date) : dayjs(),
          updated: postData.updated ? dayjs(postData.updated) : dayjs(),
        });
      }
    } catch (error) {
      console.error("加载文章失败:", error);
      message.error("加载文章失败");
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
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
   * 生成描述（流式）
   * 参考 nnnnzs.cn/components/Post/Edit.vue 的 genDescription
   */
  const genDescription = async () => {
    const content = form.getFieldValue("content") || "";
    if (!content.trim()) {
      message.warning("请先输入文章内容");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, generateDescription: true }));

      // 先清空描述字段
      form.setFieldsValue({ description: "" });

      let accumulatedText = "";

      // 使用封装的流式处理函数
      await fetchAndProcessStream(
        "/api/ai/generate/description",
        {
          method: "POST",
          body: JSON.stringify({ content }),
        },
        {
          onChunk: (chunk) => {
            // 累积文本并实时更新表单字段
            accumulatedText += chunk;
            form.setFieldsValue({ description: accumulatedText });
          },
          onComplete: () => {
            message.success("描述生成成功");
          },
          onError: (error) => {
            console.error("生成描述失败:", error);
            message.error("生成描述失败");
          },
        }
      );
    } catch (error) {
      console.error("生成描述失败:", error);
      message.error("生成描述失败");
    } finally {
      setLoading((prev) => ({ ...prev, generateDescription: false }));
    }
  };

  /**
   * 生成背景图
   */
  const genCover = () => {
    const date = form.getFieldValue("date") || dayjs();
    const dateStr = dayjs(date).format("YYYYMMDD");
    const cover = `https://static.nnnnzs.cn/bing/${dateStr}.png`;
    form.setFieldsValue({ cover });
  };

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading((prev) => ({ ...prev, submit: true }));

      // 生成路径 - 已移至服务端
      // const { path, oldTitle } = genPath({
      //   title: values.title,
      //   date: values.date,
      // });

      // 处理标签：直接使用表单的 tags 字段（已经是数组）
      const postData = {
        ...values,
        tags: values.tags || [], // 确保 tags 是数组
        date: dayjs(values.date).format("YYYY-MM-DD HH:mm:ss"),
        updated: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        visitors: values.visitors || 0,
        likes: values.likes || 0,
      };

      if (isNewPost) {
        // 创建新文章
        const response = await axios.post("/api/post/create", postData);
        if (response.data.status) {
          message.success("创建成功");
          const newId = response.data.data.id;
          router.replace(`/c/edit/${newId}`);
        }
      } else {
        // 更新现有文章
        await axios.put(`/api/post/${params.id}`, postData);
        message.success("保存成功");
        loadPost();
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) {
        // 表单验证错误
        return;
      }
      console.error("操作失败:", error);
      message.error(isNewPost ? "创建失败" : "保存失败");
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  if (authLoading || loading.fetch) {
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
    <div className="w-full h-full  overflow-hidden p-2 editor flex flex-col">
      <Form
        form={form}
        className="form mb-3"
        initialValues={{
          date: dayjs(),
          updated: dayjs(),
          hide: "0",
          visitors: 0,
          likes: 0,
          tags: [], // 初始化 tags 为空数组
        }}
      >
        {/* 第一行：标题、标签、发布状态、按钮 */}
        <Row gutter={[12, 8]} align="middle" className="mb-2">
          <Col flex="auto">
            <Form.Item
              label="标题"
              name="title"
              className="mb-0"
              rules={[{ required: true, message: "请输入标题" }]}
            >
              <Input placeholder="请输入文章标题" />
            </Form.Item>
          </Col>
          <Col flex="280px">
            <Form.Item label="标签" name="tags" className="mb-0">
              <Select
                mode="tags"
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={tags.map((tag) => ({
                  value: tag[0],
                  label: tag[0],
                }))}
                placeholder="选择标签"
              />
            </Form.Item>
          </Col>
          <Col flex="140px">
            <Form.Item
              label="发布"
              name="hide"
              className="mb-0"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio value="0">是</Radio>
                <Radio value="1">否</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col flex="240px">
            <Space>
              <Button
                onClick={genDescription}
                loading={loading.generateDescription}
              >
                生成描述
              </Button>
              <Button onClick={genCover}>生成背景</Button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={loading.submit}
                icon={<SaveOutlined />}
              >
                保存
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 第二行：描述、背景图 */}
        <Row gutter={[12, 8]} align="middle" className="mb-2">
          <Col flex="auto">
            <Form.Item label="描述" name="description" className="mb-0">
              <Input placeholder="请输入文章描述" />
            </Form.Item>
          </Col>
          <Col flex="380px">
            <Form.Item label="背景图" name="cover" className="mb-0">
              <Input placeholder="背景图URL" />
            </Form.Item>
          </Col>
        </Row>

        {/* 第三行：日期、访客、点赞 */}
        <Row gutter={[12, 8]} align="middle">
          <Col flex="240px">
            <Form.Item
              label="发布日期"
              name="date"
              className="mb-0"
              rules={[{ required: true }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                className="w-full"
              />
            </Form.Item>
          </Col>
          <Col flex="240px">
            <Form.Item label="更新日期" name="updated" className="mb-0">
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                disabled
                className="w-full"
              />
            </Form.Item>
          </Col>
          <Col flex="140px">
            <Form.Item label="访客数" name="visitors" className="mb-0">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </Col>
          <Col flex="140px">
            <Form.Item label="点赞" name="likes" className="mb-0">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div
        className="flex-1 overflow-hidden flex flex-col"
        style={{ minHeight: 0 }}
      >
        <MarkdownEditor
          className="flex-1 overflow-hidden"
          value={form.getFieldValue("content") || ""}
          onChange={(value) => {
            form.setFieldsValue({ content: value });
          }}
          placeholder="支持 Markdown 格式，可以直接粘贴图片..."
        />
      </div>
    </div>
  );
}
