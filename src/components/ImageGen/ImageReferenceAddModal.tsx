"use client";

import React, { useState } from "react";
import { Alert, Button, Image, Input, Modal, Segmented, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { DeleteOutlined, LinkOutlined, UploadOutlined } from "@ant-design/icons";

export interface AddedImageReference {
  url: string;
  title?: string;
}

interface ImageReferenceAddModalProps {
  open: boolean;
  onClose: () => void;
  onReferenceAdded: (reference: AddedImageReference) => void;
}

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

type ReferenceSource = "file" | "url";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("读取图片失败"));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export default function ImageReferenceAddModal({
  open,
  onClose,
  onReferenceAdded,
}: ImageReferenceAddModalProps) {
  const [source, setSource] = useState<ReferenceSource>("file");
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSource("file");
    setFile(null);
    setFileDataUrl(null);
    setImageUrl("");
    setPreviewFailed(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const uploadProps: UploadProps = {
    accept: "image/png,image/jpeg,image/webp,image/gif",
    maxCount: 1,
    beforeUpload: async (nextFile) => {
      if (!ACCEPTED_TYPES.has(nextFile.type)) {
        message.error("仅支持 PNG、JPEG、WebP、GIF 图片");
        return Upload.LIST_IGNORE;
      }
      if (nextFile.size > MAX_FILE_BYTES) {
        message.error("参考图不能超过 15MB");
        return Upload.LIST_IGNORE;
      }
      try {
        setFile(nextFile);
        setFileDataUrl(await readAsDataUrl(nextFile));
      } catch (error) {
        message.error(error instanceof Error ? error.message : "读取图片失败");
      }
      return false;
    },
    onRemove: () => {
      setFile(null);
      setFileDataUrl(null);
      return true;
    },
  };

  const clearFile = () => {
    setFile(null);
    setFileDataUrl(null);
  };
  const clearImageUrl = () => {
    setImageUrl("");
    setPreviewFailed(false);
  };

  const normalizedImageUrl = imageUrl.trim();
  const hasPreviewableUrl = /^https:\/\//i.test(normalizedImageUrl);
  const previewUrl = source === "file" ? fileDataUrl : (hasPreviewableUrl ? normalizedImageUrl : null);

  const confirm = async () => {
    if (source === "file" && (!file || !fileDataUrl)) {
      message.warning("请选择参考图");
      return;
    }
    if (source === "url" && !hasPreviewableUrl) {
      message.warning("图片外链必须以 https:// 开头");
      return;
    }
    if (source === "url" && previewFailed) {
      message.warning("请使用可公开访问的图片外链");
      return;
    }

    setSubmitting(true);
    try {
      if (source === "file" && file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/image-gen/references/upload", {
          method: "POST",
          cache: "no-store",
          body: formData,
        });
        const payload = await response.json() as ApiResponse<{ imageUrl: string }>;
        if (!response.ok || !payload.status || !payload.data?.imageUrl) {
          throw new Error(payload.message || "上传参考图片失败");
        }
        onReferenceAdded({
          url: payload.data.imageUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
        });
      } else {
        onReferenceAdded({ url: normalizedImageUrl });
      }
      close();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传参考图片失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="添加参考图" open={open} onOk={confirm} onCancel={close} confirmLoading={submitting} okText="添加" destroyOnHidden>
      <div className="flex flex-col gap-4">
        <Segmented
          block
          value={source}
          onChange={(value) => {
            setSource(value as ReferenceSource);
            setPreviewFailed(false);
          }}
          options={[{ label: "上传图片", value: "file" }, { label: "图片外链", value: "url" }]}
        />
        {source === "file" ? (
          <>
            <Upload.Dragger {...uploadProps} showUploadList={false}>
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">选择或拖入参考图</p>
              <p className="ant-upload-hint">上传到参考图存储，不会添加到素材库</p>
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
        {previewUrl ? (
          previewFailed ? (
            <Alert type="warning" showIcon message="图片预览加载失败，请检查外链是否可公开访问" />
          ) : (
            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
              <Image
                src={previewUrl}
                alt="待添加参考图预览"
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
      </div>
    </Modal>
  );
}
