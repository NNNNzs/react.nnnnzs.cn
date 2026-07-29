/**
 * 合集编辑页面
 * 路由: /c/collections/[id]
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  message,
  Space,
  Spin,
  Tabs,
  Tag,
  type FormInstance,
  type TabsProps,
} from 'antd';
import {
  ArrowLeftOutlined,
  EyeOutlined,
  SaveOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { COLLECTION_CREATE, COLLECTION_EDIT } from '@/constants/permissions';
import { useAuth } from '@/contexts/AuthContext';
import type { SerializedCollection } from '@/dto/collection.dto';
import {
  createEmptyCollectionVisualConfig,
  createCollectionVisualConfigWithLegacyFallback,
  normalizeCollectionVisualConfigForSubmit,
  type CollectionThemeVisual,
  type CollectionVisualConfig,
  type CollectionVisualTheme,
} from '@/lib/collection-visual';
import MediaUpload from '@/components/MediaUpload';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

const { TextArea } = Input;

interface CollectionFormValues {
  title: string;
  slug: string;
  description?: string;
  extends_json: CollectionVisualConfig;
}

interface VisualThemeFieldsProps {
  theme: CollectionVisualTheme;
}

/** 日间或夜间的一组视觉资源表单。 */
function VisualThemeFields({ theme }: VisualThemeFieldsProps) {
  const prefix = ['extends_json', 'presentation', theme] as const;
  const label = theme === 'day' ? '日间' : '夜间';

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Form.Item
        label={`${label}竖长封面`}
        name={[...prefix, 'coverImageUrl']}
        tooltip="档案盒展开后的主体封面，固定 9:16"
      >
        <MediaUpload
          placeholder={`${label} 9:16 封面 CDN URL`}
          defaultAspectRatio={9 / 16}
          allowChangeAspectRatio={false}
          accept="image/*"
          cropperTitle={`裁剪${label}竖长封面`}
        />
      </Form.Item>

      <Form.Item
        label={`${label}竖长封面视频`}
        name={[...prefix, 'coverVideoUrl']}
        tooltip="选中合集后在竖长封面位置静音循环播放，固定 9:16"
      >
        <MediaUpload
          placeholder={`${label} 9:16 MP4/WebM CDN URL`}
          enableCrop={false}
          accept="video/*"
        />
      </Form.Item>

      <Form.Item
        label={`${label}页面背景图`}
        name={[...prefix, 'backgroundImageUrl']}
        tooltip="合集详情页首屏的静态空间背景，固定 16:9"
      >
        <MediaUpload
          placeholder={`${label} 16:9 页面背景图 CDN URL`}
          defaultAspectRatio={16 / 9}
          allowChangeAspectRatio={false}
          accept="image/*"
          cropperTitle={`裁剪${label}页面背景图`}
        />
      </Form.Item>

      <Form.Item
        label="资源焦点位置"
        name={[...prefix, 'objectPosition']}
        extra="使用 CSS object-position 写法，例如 50% 35%"
      >
        <Input placeholder="50% 50%" />
      </Form.Item>

      <Form.Item
        label="主题强调色"
        name={[...prefix, 'accentColor']}
        rules={[{
          pattern: /^#[0-9A-Fa-f]{6}$/,
          message: '请输入六位十六进制颜色',
        }]}
      >
        <Input type="color" className="max-w-32" />
      </Form.Item>
    </div>
  );
}

interface CollectionVisualPreviewProps {
  form: FormInstance<CollectionFormValues>;
}

/** 在保存前并排预览昼夜竖长封面和氛围背景。 */
function CollectionVisualPreview({ form }: CollectionVisualPreviewProps) {
  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const title = form.getFieldValue('title') || '未命名合集';
        const visual = form.getFieldValue('extends_json') as CollectionVisualConfig | undefined;

        return (
          <div className="grid gap-5 lg:grid-cols-2">
            {(['day', 'night'] as const).map((theme) => {
              const item: CollectionThemeVisual = visual?.presentation?.[theme] || {};
              const background = item.backgroundImageUrl;
              const cover = item.coverImageUrl;
              const coverVideo = item.coverVideoUrl;

              return (
                <Card
                  key={theme}
                  title={theme === 'day' ? '日间预览' : '夜间预览'}
                  extra={<Tag color={theme === 'day' ? 'gold' : 'cyan'}>{theme}</Tag>}
                  className={theme === 'night' ? 'bg-slate-950 text-white' : 'bg-stone-50'}
                >
                  <div className="relative min-h-80 overflow-hidden rounded-lg border border-black/10">
                    {background ? (
                      <Image
                        src={background}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover opacity-45"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#dbe8ec,transparent_60%)] dark:bg-[radial-gradient(circle_at_top,#12324a,transparent_65%)]" />
                    )}
                    <div className="relative z-10 flex min-h-80 items-center gap-5 p-6">
                      <div className="relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-sm bg-black/10 shadow-2xl">
                        {coverVideo ? (
                          <video
                            aria-hidden="true"
                            src={coverVideo}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: item.objectPosition || '50% 50%' }}
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="metadata"
                          />
                        ) : cover ? (
                          <Image
                            src={cover}
                            alt={`${title}${theme === 'day' ? '日间' : '夜间'}封面`}
                            fill
                            unoptimized
                            className="object-cover"
                            style={{ objectPosition: item.objectPosition || '50% 50%' }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-3 text-center text-xs opacity-60">
                            尚未配置竖长封面
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-3 text-xs uppercase tracking-[0.22em] opacity-60">
                          {theme === 'day' ? '主题书架' : '归档矩阵'}
                        </div>
                        <h2 className="text-2xl font-semibold">{title}</h2>
                        <p className="mt-3 text-sm leading-6 opacity-70">
                          {form.getFieldValue('description') || '补充一段描述，让展开后的资料页更完整。'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      }}
    </Form.Item>
  );
}

/** 合集基础信息和昼夜资源编辑页。 */
export default function CollectionEditPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;
  const isEdit = collectionId !== 'new';
  const canSave = hasPermission(isEdit ? COLLECTION_EDIT : COLLECTION_CREATE);

  const [form] = Form.useForm<CollectionFormValues>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !user) return;

    const fetchCollection = async () => {
      setFetching(true);
      try {
        const response = await axios.get(`/api/collection/${collectionId}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const collection = response.data.data as SerializedCollection;
        form.setFieldsValue({
          title: collection.title,
          slug: collection.slug,
          description: collection.description || undefined,
          extends_json: createCollectionVisualConfigWithLegacyFallback(collection),
        });
      } catch (error) {
        console.error('获取合集信息失败:', error);
        message.error('获取合集信息失败');
        void router.push('/c/collections');
      } finally {
        setFetching(false);
      }
    };

    void fetchCollection();
  }, [collectionId, form, isEdit, router, user]);

  const tabItems = useMemo<TabsProps['items']>(() => [
    {
      key: 'base',
      label: '基础信息',
      forceRender: true,
      children: (
        <div className="grid gap-x-6 lg:grid-cols-2">
          <Form.Item
            label="合集标题"
            name="title"
            rules={[
              { required: true, message: '请输入合集标题' },
              { max: 255, message: '标题不能超过 255 个字符' },
            ]}
          >
            <Input placeholder="请输入合集标题" />
          </Form.Item>

          <Form.Item
            label="URL Slug"
            name="slug"
            rules={[
              { required: true, message: '请输入 Slug' },
              { max: 191, message: 'Slug 不能超过 191 个字符' },
              { pattern: /^[a-z0-9-]+$/, message: 'Slug 只能包含小写字母、数字和连字符' },
            ]}
          >
            <Input placeholder="例如: nextjs-series" />
          </Form.Item>

          <Form.Item
            className="lg:col-span-2"
            label="合集描述"
            name="description"
            rules={[{ max: 1000, message: '描述不能超过 1000 个字符' }]}
            extra="建议 40–100 字；它同时用于展开资料页与 SEO metadata。"
          >
            <TextArea rows={5} placeholder="这组文章在讨论什么、适合谁、建议从哪里开始阅读" />
          </Form.Item>

        </div>
      ),
    },
    { key: 'day', label: '日间视觉', forceRender: true, children: <VisualThemeFields theme="day" /> },
    { key: 'night', label: '夜间视觉', forceRender: true, children: <VisualThemeFields theme="night" /> },
    {
      key: 'preview',
      label: <Space><EyeOutlined />前台预览</Space>,
      forceRender: true,
      children: <CollectionVisualPreview form={form} />,
    },
  ], [form]);

  const handleSubmit = async (values: CollectionFormValues) => {
    if (!user || !canSave) return;

    setLoading(true);
    try {
      const payload: CollectionFormValues = {
        ...values,
        extends_json: normalizeCollectionVisualConfigForSubmit(
          form.getFieldValue('extends_json'),
        ),
      };
      const response = isEdit
        ? await axios.put(`/api/collection/${collectionId}`, payload)
        : await axios.post('/api/collection/create', payload);

      if (!response.data.status) {
        throw new Error(response.data.message || '保存失败');
      }

      message.success(isEdit ? '合集已更新' : '合集已创建');
      void router.push('/c/collections');
    } catch (error: unknown) {
      console.error('保存合集失败:', error);
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <Form form={form} component={false} />
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <AdminPageHeader
        title={isEdit ? '编辑合集' : '创建合集'}
        extra={(
          <Space>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => router.push('/c/collections')}>
              返回
            </Button>
            {isEdit ? (
              <Button size="small" icon={<UnorderedListOutlined />} onClick={() => router.push(`/c/collections/${collectionId}/posts`)}>
                管理文章
              </Button>
            ) : null}
            {canSave ? (
              <Button
                size="small"
                color="primary"
                variant="solid"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={() => form.submit()}
              >
                保存
              </Button>
            ) : null}
          </Space>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {!canSave ? (
          <Alert title="当前账号只有查看权限" type="warning" showIcon className="mb-4" />
        ) : null}
        <Card>
          <Form<CollectionFormValues>
            form={form}
            layout="vertical"
            disabled={!canSave}
            initialValues={{ extends_json: createEmptyCollectionVisualConfig() }}
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Tabs items={tabItems} />
          </Form>
        </Card>
      </div>
    </div>
  );
}
