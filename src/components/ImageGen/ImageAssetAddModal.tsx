"use client";

import React, { useEffect, useState } from "react";
import { Alert, Button, Image, Input, Modal, Segmented, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { DeleteOutlined, LinkOutlined, UploadOutlined } from "@ant-design/icons";

export interface AddedImageAsset {
  id: number;
  title?: string | null;
  usage?: string | null;
  cdn_url?: string | null;
}

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface ImageAssetAddModalProps {
  open: boolean;
  defaultGroup?: string;
  onClose: () => void;
  onAssetAdded: (asset: AddedImageAsset) => void;
}

type UploadMode = "file" | "url";

async function requestJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.status) throw new Error(payload.message || "请求失败");
  return payload.data;
}

async function requestForm<T>(url: string, formData: FormData) {
  const response = await fetch(url, { method: "POST", cache: "no-store", body: formData });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.status) throw new Error(payload.message || "请求失败");
  return payload.data;
}

export default function ImageAssetAddModal({
  open,
  defaultGroup,
  onClose,
  onAssetAdded,
}: ImageAssetAddModalProps) {
  const [mode, setMode] = useState<UploadMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setGroup(defaultGroup || "");
  }, [defaultGroup, open]);

  const reset = () => {
    setMode("file");
    setFile(null);
    setImageUrl("");
    setPreviewFailed(false);
    setTitle("");
    setGroup(defaultGroup || "");
  };

  const close = () => {
    reset();
    onClose();
  };

  const uploadProps: UploadProps = {
    accept: "image/*",
    maxCount: 1,
    beforeUpload: (nextFile) => {
      setFile(nextFile);
      if (!title.trim()) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
      return false;
    },
    onRemove: () => {
      setFile(null);
      return true;
    },
  };

  const clearFile = () => setFile(null);
  const clearImageUrl = () => {
    setImageUrl("");
    setPreviewFailed(false);
  };

  const submit = async () => {
    if (mode === "file" && !file) {
      message.warning("请选择图片");
      return;
    }
    if (mode === "url" && !/^https:\/\//i.test(imageUrl.trim())) {
      message.warning("图片外链必须以 https:// 开头");
      return;
    }

    setSubmitting(true);
    try {
      const asset = mode === "url"
        ? await requestJson<AddedImageAsset>("/api/create/assets", {
          method: "POST",
          body: JSON.stringify({
            image_url: imageUrl.trim(),
            title: title.trim() || undefined,
            group: group.trim() || undefined,
          }),
        })
        : await (() => {
          const formData = new FormData();
          formData.append("inputFile", file as File);
          if (title.trim()) formData.append("title", title.trim());
          if (group.trim()) formData.append("group", group.trim());
          return requestForm<AddedImageAsset>("/api/create/assets/upload", formData);
        })();
      message.success("图片素材已添加");
      onAssetAdded(asset);
      close();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加图片素材失败");
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedImageUrl = imageUrl.trim();
  const hasPreviewableUrl = /^https:\/\//i.test(normalizedImageUrl);

  return (
    <Modal
      title="添加图片素材"
      open={open}
      onOk={submit}
      onCancel={close}
      confirmLoading={submitting}
      okText={mode === "url" ? "添加" : "上传"}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4">
        <Segmented
          block
          value={mode}
          onChange={(value) => setMode(value as UploadMode)}
          options={[{ label: "上传图片", value: "file" }, { label: "图片外链", value: "url" }]}
        />
        {mode === "file" ? (
          <>
            <Upload.Dragger {...uploadProps} showUploadList={false}>
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">选择或拖入图片</p>
            </Upload.Dragger>
            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">已选：{file.name}</span>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={clearFile}>移除</Button>
              </div>
            ) : null}
          </>
        ) : (
          <Input
            value={imageUrl}
            onChange={(event) => {
              setImageUrl(event.target.value);
              setPreviewFailed(false);
            }}
            placeholder="https://example.com/image.png"
            prefix={<LinkOutlined className="text-slate-400" />}
            maxLength={5000}
            allowClear
          />
        )}
        {mode === "url" && hasPreviewableUrl ? (
          previewFailed ? (
            <Alert type="warning" showIcon message="图片预览加载失败，请检查外链是否可公开访问" />
          ) : (
            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
              <Image
                src={normalizedImageUrl}
                alt="待添加图片预览"
                className="max-h-56 w-full object-contain"
                onError={() => setPreviewFailed(true)}
              />
              <Button
                className="absolute right-2 top-2 z-10 !bg-white"
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearImageUrl}
              >
                移除
              </Button>
            </div>
          )
        ) : null}
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="图片名称" maxLength={255} />
        <Input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="分组（可选）" maxLength={60} />
      </div>
    </Modal>
  );
}
