/**
 * 编辑文章页 - Linear 风格重构
 * 极简顶部栏 + 右侧属性抽屉 + 预览抽屉
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Spin,
  DatePicker,
  Drawer,
  Radio,
  Space,
  Divider,
  Tooltip,
} from "antd";
import {
  SaveOutlined,
  TagsOutlined,
  FolderOutlined,
  EyeOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import type { Post } from "@/types";
import MarkdownEditor from "@/components/MarkdownEditor";
import CollectionSelector from "@/components/CollectionSelector";
import MediaUpload from "@/components/MediaUpload";
import { fetchAndProcessStream } from "@/lib/stream";
import MarkdownPreview from "@/components/MarkdownPreview";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [form] = Form.useForm();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState({
    submit: false,
    generateDescription: false,
    fetch: true,
  });
  const [post, setPost] = useState<Post | null>(null);
  const [tags, setTags] = useState<[string, number][]>([]);
  // 保存原始日期，用于比较是否真的修改了
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  // 抽屉状态
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);

  const isNewPost = params.id === "new";
  const { isMobile } = useBreakpoint();

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
  const loadTags = useCallback(async () => {
    try {
      const response = await axios.get("/api/post/tags");
      if (response.data.status) {
        const tagList = response.data.data.filter(
          (e: [string, number]) => e[0],
        );
        setTags(tagList);
      }
    } catch (error) {
      console.error("加载标签失败:", error);
    }
  }, []);

  /**
   * 加载文章数据
   */
  const loadPost = useCallback(async () => {
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

        // 保存原始日期（用于比较是否修改）
        if (postData.date) {
          setOriginalDate(dayjs(postData.date).format("YYYY-MM-DD HH:mm:ss"));
        }

        let collectionIds: number[] = [];
        try {
          const collectionsRes = await axios.get(
            `/api/post/${params.id}/collections`,
          );
          if (collectionsRes.data.status) {
            collectionIds = collectionsRes.data.data.map(
              (c: { id: number }) => c.id,
            );
          }
        } catch (error) {
          console.error("加载文章合集失败:", error);
        }

        form.setFieldsValue({
          ...postData,
          tags: postData.tags || [],
          date: postData.date ? dayjs(postData.date) : dayjs(),
          updated: postData.updated ? dayjs(postData.updated) : dayjs(),
          collection_ids: collectionIds,
        });
        setContent(postData.content || "");
      }
    } catch (error) {
      console.error("加载文章失败:", error);
      message.error("加载文章失败");
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
    }
  }, [form, isNewPost, params.id]);

  useEffect(() => {
    if (user) {
      loadTags();
      loadPost();
    }
  }, [user, loadTags, loadPost]);

  /**
   * 键盘快捷键
   */
  const handleSubmit = useCallback(async () => {
    try {
      // 验证必填字段（标题和内容）
      await form.validateFields(["title", "content"]);

      // 获取所有表单字段值（包括抽屉里的字段）
      const values = form.getFieldsValue();
      setLoading((prev) => ({ ...prev, submit: true }));

      console.log("📋 提交表单数据:", values);

      // 处理日期字段
      const formDate = values.date
        ? dayjs(values.date).format("YYYY-MM-DD HH:mm:ss")
        : null;
      const shouldUpdateDate =
        isNewPost || (originalDate && formDate !== originalDate);

      // 构建提交数据
      const postData: Record<string, unknown> = {
        title: values.title,
        content: values.content || "",
        tags: values.tags || [],
        category: values.category || null,
        description: values.description || null,
        hide: values.hide || "0",
        layout: values.layout || null,
        collection_ids: values.collection_ids || [],
      };

      // 处理日期字段：只有修改时才发送
      if (shouldUpdateDate && formDate) {
        postData.date = formDate;
      }

      // 处理 cover 字段：有值才发送（包括空值，让后端决定是否生成）
      if (values.cover !== undefined) {
        postData.cover = values.cover || null;
      }

      if (isNewPost) {
        const response = await axios.post("/api/post/create", postData);
        if (response.data.status) {
          const newId = response.data.data.id;
          const collectionIds = postData.collection_ids as number[];

          if (collectionIds.length > 0) {
            console.log("📝 创建文章后关联合集:", { newId, collectionIds });
            try {
              await Promise.all(
                collectionIds.map((collectionId: number) =>
                  axios.post(`/api/collection/${collectionId}/posts`, {
                    post_ids: [newId],
                  }),
                ),
              );
              console.log("✅ 合集关联成功");
            } catch (collectionError) {
              console.error("❌ 合集关联失败:", collectionError);
              message.warning("文章创建成功，但合集关联失败，请手动添加");
            }
          }

          message.success("创建成功");
          router.replace(`/c/edit/${newId}`);
        }
      } else {
        await axios.patch(`/api/post/${params.id}`, postData);

        const currentCollectionsRes = await axios.get(
          `/api/post/${params.id}/collections`,
        );
        const currentCollectionIds = currentCollectionsRes.data.status
          ? currentCollectionsRes.data.data.map((c: { id: number }) => c.id)
          : [];

        const collectionIds = postData.collection_ids as number[];
        const toAdd = collectionIds.filter(
          (id: number) => !currentCollectionIds.includes(id),
        );
        const toRemove = currentCollectionIds.filter(
          (id: number) => !collectionIds.includes(id),
        );

        if (toAdd.length > 0) {
          try {
            await Promise.all(
              toAdd.map((collectionId: number) =>
                axios.post(`/api/collection/${collectionId}/posts`, {
                  post_ids: [params.id],
                }),
              ),
            );
          } catch (addError) {
            console.error("❌ 添加到合集失败:", addError);
            message.error("添加到合集失败");
          }
        }

        if (toRemove.length > 0) {
          try {
            await Promise.all(
              toRemove.map((collectionId: number) =>
                axios.delete(`/api/collection/${collectionId}/posts`, {
                  data: { post_ids: [params.id] },
                }),
              ),
            );
          } catch (removeError) {
            console.error("❌ 从合集移除失败:", removeError);
            message.error("从合集移除失败");
          }
        }

        message.success("保存成功");
        loadPost();
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }
      console.error("操作失败:", error);
      message.error(isNewPost ? "创建失败" : "保存失败");
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  }, [form, isNewPost, loadPost, originalDate, params.id, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;


      if (cmdOrCtrl) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            handleSubmit();
            break;
          case ",":
            e.preventDefault();
            setSettingsDrawerOpen((prev) => !prev);
            break;
          case "p":
            e.preventDefault();
            setPreviewDrawerOpen((prev) => !prev);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

  /**
   * 生成描述（流式）
   */
  const genDescription = async () => {
    const currentContent = content || form.getFieldValue("content") || "";
    if (!content.trim()) {
      message.warning("请先输入文章内容");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, generateDescription: true }));
      form.setFieldsValue({ description: "" });

      let accumulatedText = "";

      await fetchAndProcessStream(
        "/api/ai/generate/description",
        {
          method: "POST",
          body: JSON.stringify({ content: currentContent }),
        },
        {
          onChunk: (chunk) => {
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
        },
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

  if (authLoading || loading.fetch) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Spin size="large" />
      </div>
    );
  }

  if (!user || (!post && !isNewPost)) {
    return null;
  }

  const hideValue = form.getFieldValue("hide") || "0";
  const isPublished = hideValue === "0";

  return (
    <div className="h-full flex flex-col">
      <Form
        form={form}
        className="h-full flex flex-col"
        initialValues={{
          date: dayjs(),
          updated: dayjs(),
          hide: "0",
          tags: [],
          content: "",
          collection_ids: [],
        }}
      >
        {/* 极简顶部栏 */}
        <div className="shrink-0 border-b border-neutral-200 bg-white px-3 md:px-6 py-3 mb-2 md:mb-4">
          <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
            {/* 左侧：状态指示 */}
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip title={isPublished ? "已发布" : "隐藏中"}>
                <div
                  className={`w-2 h-2 rounded-full ${isPublished ? "bg-green-500" : "bg-amber-500"}`}
                />
              </Tooltip>
              {!isMobile && (
                <Form.Item name="hide" className="mb-0" noStyle>
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Radio.Button value="0">发布</Radio.Button>
                    <Radio.Button value="1">隐藏</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              )}
            </div>

            {/* 中间：标题输入 */}
            <div className="flex-1 min-w-0">
              <Form.Item
                name="title"
                className="mb-0"
                noStyle
                rules={[{ required: true, message: "请输入标题" }]}
              >
                <Input
                  placeholder="无标题文章"
                  className={`font-semibold ${isMobile ? '' : 'text-lg'}`}
                  style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600 }}
                />
              </Form.Item>
            </div>

            {/* 右侧：快捷标签 + 操作按钮 */}
            <div className={`flex items-center shrink-0 ${isMobile ? 'gap-1' : 'gap-2'}`}>
              {/* 快捷标签选择 - 桌面端显示 */}
              {!isMobile && (
                <>
                  <Form.Item name="tags" className="mb-0" noStyle>
                    <Select
                      mode="tags"
                      maxTagCount={3}
                      placeholder="+ 标签"
                      bordered={false}
                      suffixIcon={<TagsOutlined className="text-neutral-400" />}
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      options={tags.map((tag) => ({
                        value: tag[0],
                        label: tag[0],
                      }))}
                      style={{ minWidth: 200 }}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    />
                  </Form.Item>

                  <Divider type="vertical" className="h-6 mx-1" />
                </>
              )}

              <Form.Item className="mb-0" noStyle>
                <Tooltip title="预览 (Cmd+P)">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewDrawerOpen(true)}
                  />
                </Tooltip>
              </Form.Item>

              <Form.Item className="mb-0" noStyle>
                <Tooltip title="设置 (Cmd+,)">
                  <Button
                    type="text"
                    icon={<SettingOutlined />}
                    onClick={() => setSettingsDrawerOpen(true)}
                  />
                </Tooltip>
              </Form.Item>

              <Form.Item className="mb-0" noStyle>
                <Tooltip title="保存 (Cmd+S)">
                  <Button
                    type="primary"
                    onClick={handleSubmit}
                    loading={loading.submit}
                    icon={isMobile ? <SaveOutlined /> : undefined}
                    size={isMobile ? 'middle' : 'middle'}
                  >
                    {isMobile ? '' : '保存'}
                  </Button>
                </Tooltip>
              </Form.Item>
            </div>
          </div>
        </div>

        {/* 隐藏的 content 字段用于表单验证 */}
        <Form.Item
          name="content"
          rules={[{ required: true, message: "请输入文章内容" }]}
          hidden
        >
          <Input />
        </Form.Item>

        {/* 主编辑区 */}
        <div className="flex-1 overflow-hidden">
          <MarkdownEditor
            className="h-full"
            value={content}
            onChange={(value) => {
              setContent(value);
              form.setFieldsValue({ content: value });
            }}
            placeholder="开始写作..."
            preview={false}
          />
        </div>

        {/* 右侧设置抽屉 */}
        <Drawer
          title={
            <div className="flex items-center gap-2">
              <SettingOutlined />
              <span>文章设置</span>
            </div>
          }
          placement="right"
          width={400}
          open={settingsDrawerOpen}
          onClose={() => setSettingsDrawerOpen(false)}
          styles={{
            body: { padding: 24 },
          }}
        >
          {/* 抽屉内使用同一个 Form 实例，通过 Form.Item 包裹，无需新建 form */}
          <div className="drawer-form-content">
            {/* 文章元信息 */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
                元信息
              </h4>

              <Form.Item label="描述" name="description">
                <Input.TextArea
                  placeholder="文章描述"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              <Form.Item label="背景图" name="cover">
                <MediaUpload
                  placeholder="背景图URL"
                  defaultAspectRatio={16 / 9}
                />
              </Form.Item>
            </div>

            <Divider className="my-6" />

            {/* 分类 */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
                分类
              </h4>

              <Form.Item label="标签" name="tags">
                <Select
                  mode="multiple"
                  placeholder="选择标签"
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={tags.map((tag) => ({
                    value: tag[0],
                    label: tag[0],
                  }))}
                />
              </Form.Item>

              <Form.Item label="所属合集" name="collection_ids">
                <CollectionSelector
                  placeholder="选择合集（可多选）"
                  mode="multiple"
                />
              </Form.Item>
            </div>

            <Divider className="my-6" />

            {/* 时间设置 */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
                时间
              </h4>

              <Form.Item
                label="发布日期"
                name="date"
                rules={[{ required: true }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  className="w-full"
                />
              </Form.Item>

              <Form.Item label="更新日期" name="updated">
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  disabled
                  className="w-full"
                />
              </Form.Item>
            </div>

            {/* AI 工具 */}
            <Divider className="my-6" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
                AI 辅助
              </h4>
              <Space direction="vertical" className="w-full">
                <Button
                  block
                  icon={<TagsOutlined />}
                  onClick={genDescription}
                  loading={loading.generateDescription}
                >
                  生成描述
                </Button>
                <Button block icon={<FolderOutlined />} onClick={genCover}>
                  生成背景图
                </Button>
              </Space>
            </div>
          </div>
        </Drawer>

        {/* 预览抽屉 */}
        <Drawer
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeOutlined />
                <span>预览</span>
              </div>
              <div className="text-sm text-neutral-400">
                {form.getFieldValue("title") || "无标题文章"}
              </div>
            </div>
          }
          placement="right"
          width={800}
          open={previewDrawerOpen}
          onClose={() => setPreviewDrawerOpen(false)}
          styles={{
            body: { padding: 0, background: "#fafafa" },
          }}
        >
          <div className="h-full overflow-y-auto">
            <article className="max-w-3xl mx-auto px-8 py-12 bg-white min-h-full shadow-sm">
              {/* 标题 */}
              <h1 className="text-4xl font-bold text-neutral-900 mb-6">
                {form.getFieldValue("title") || "无标题文章"}
              </h1>

              {/* 元信息 */}
              <div className="flex items-center gap-4 text-sm text-neutral-500 mb-8 pb-6 border-b border-neutral-200">
                <span>
                  {dayjs(form.getFieldValue("date")).format("YYYY年MM月DD日")}
                </span>
                {(form.getFieldValue("tags") || []).length > 0 && (
                  <>
                    <span>·</span>
                    <div className="flex gap-2">
                      {form.getFieldValue("tags").map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-neutral-100 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 描述 */}
              {form.getFieldValue("description") && (
                <div className="text-lg text-neutral-600 leading-relaxed mb-8 p-6 bg-neutral-50 rounded-lg border-l-4 border-neutral-300">
                  {form.getFieldValue("description")}
                </div>
              )}

              {/* 内容 */}
              <MarkdownPreview content={content} />

              {/* 底部 */}
              <div className="mt-16 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-400">
                <p>本文由 {user?.nickname || user?.account} 创作</p>
                <p className="mt-1">
                  最后更新：
                  {dayjs(form.getFieldValue("updated")).format(
                    "YYYY-MM-DD HH:mm",
                  )}
                </p>
              </div>
            </article>
          </div>
        </Drawer>

        {/* 快捷键提示 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="fixed bottom-4 right-4 text-xs text-neutral-300 pointer-events-none">
            <Space split={<span>·</span>}>
              <span>Cmd+S 保存</span>
              <span>Cmd+, 设置</span>
              <span>Cmd+P 预览</span>
            </Space>
          </div>
        )}
      </Form>
    </div>
  );
}
