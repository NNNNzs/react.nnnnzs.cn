"use client";

import { Button, Tag } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlusOutlined,
  ReadOutlined,
} from "@ant-design/icons";

interface CreatePlaceholderPageProps {
  title: string;
  description: string;
  status?: string;
  focus: string[];
}

const nextActions = [
  "接入内容中台数据模型",
  "关联博客文章来源",
  "接入素材生成任务",
];

export default function CreatePlaceholderPage({
  title,
  description,
  status = "占位中",
  focus,
}: CreatePlaceholderPageProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tag color="magenta">/create</Tag>
                <Tag>{status}</Tag>
              </div>
              <h1 className="text-2xl font-semibold text-slate-950 md:text-3xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button icon={<ReadOutlined />} href="/c/post">
                查看博客文章
              </Button>
              <Button type="primary" icon={<PlusOutlined />} disabled>
                新建内容
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <FileTextOutlined className="mb-3 text-xl text-slate-500" />
            <div className="text-sm font-medium text-slate-900">草稿链路</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              从博客文章和选题生成小红书图文、短视频脚本和发布清单。
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <PictureOutlined className="mb-3 text-xl text-slate-500" />
            <div className="text-sm font-medium text-slate-900">素材任务</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              复用现有图片生成、图片编辑、TTS 和后续 Remotion worker。
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <CalendarOutlined className="mb-3 text-xl text-slate-500" />
            <div className="text-sm font-medium text-slate-900">发布复盘</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              记录发布状态、数据表现和下一轮选题反馈，不做自动发布。
            </p>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="mb-4 text-sm font-medium text-slate-900">当前页面关注点</div>
          <div className="grid gap-3 md:grid-cols-2">
            {focus.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <CheckCircleOutlined className="mt-0.5 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="mb-4 text-sm font-medium text-slate-900">后续接入顺序</div>
          <ol className="grid gap-3 md:grid-cols-3">
            {nextActions.map((item, index) => (
              <li
                key={item}
                className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700"
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-medium text-white">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
