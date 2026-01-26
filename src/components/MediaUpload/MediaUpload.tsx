/**
 * 通用媒体上传组件
 * 支持 URL 输入、文件上传、图片裁剪
 * 兼容 Ant Design Form.Item
 *
 * 裁剪功能完全内聚，业务组件无需关心裁剪逻辑
 * 视频上传不支持裁剪，直接上传
 */

"use client";

import React, { useState } from "react";
import { Input, Upload, Button, Space, Image, message } from "antd";
import { UploadOutlined, DeleteOutlined, ScissorOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";
import ImageCropper from "@/components/ImageCropper";
import axios from "axios";
import "./MediaUpload.css";

export interface MediaUploadProps {
  /** 当前媒体 URL */
  value?: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示预览图，默认 true */
  showPreview?: boolean;
  /** 是否启用裁剪功能，默认 true（仅对图片有效） */
  enableCrop?: boolean;
  /** 默认裁剪框宽高比（当启用裁剪时作为默认值），0 表示自由比例 */
  defaultAspectRatio?: number;
  /** 裁剪框最小宽度 */
  minCropBoxWidth?: number;
  /** 裁剪框最小高度 */
  minCropBoxHeight?: number;
  /** 图片最大文件大小（MB），默认 10 */
  imageMaxSize?: number;
  /** 视频最大文件大小（MB），默认 100 */
  videoMaxSize?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外的样式类名 */
  className?: string;
  /** 裁剪弹窗标题 */
  cropperTitle?: string;
  /** 是否允许修改横纵比，默认 true */
  allowChangeAspectRatio?: boolean;
  /** 接受的文件类型，默认 image/*，可传 image/*,video/* 支持视频 */
  accept?: string;
}

/**
 * 检测是否为视频文件
 */
function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

/**
 * 检测是否为图片文件
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * 检测 URL 是否为视频
 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
}

/**
 * 通用媒体上传组件
 *
 * @example
 * ```tsx
 * // 基础用法（仅图片）
 * <Form.Item name="avatar" label="头像">
 *   <MediaUpload defaultAspectRatio={1} />
 * </Form.Item>
 *
 * // 背景图上传（16:9，允许修改比例）
 * <Form.Item name="cover" label="封面图">
 *   <MediaUpload defaultAspectRatio={16 / 9} />
 * </Form.Item>
 *
 * // 背景视频上传
 * <Form.Item name="background" label="背景视频">
 *   <MediaUpload accept="image/*,video/*" />
 * </Form.Item>
 *
 * // 不支持裁剪，直接上传
 * <Form.Item name="logo" label="Logo">
 *   <MediaUpload enableCrop={false} />
 * </Form.Item>
 * ```
 */
export default function MediaUpload({
  value,
  onChange,
  placeholder = "请输入媒体 URL 或点击上传",
  showPreview = true,
  enableCrop = true,
  defaultAspectRatio = 0,
  minCropBoxWidth = 50,
  minCropBoxHeight = 50,
  imageMaxSize = 10,
  videoMaxSize = 100,
  disabled = false,
  className,
  cropperTitle,
  allowChangeAspectRatio = true,
  accept = "image/*",
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [loadingUrl, setLoadingUrl] = useState(false);

  /**
   * 判断当前值是否为视频
   */
  const isCurrentValueVideo = value ? isVideoUrl(value) : false;

  /**
   * 处理 URL 输入变化
   */
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    onChange?.(url);
  };

  /**
   * 验证是否为有效的 URL
   */
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * 处理从 URL 加载媒体
   */
  const handleLoadFromUrl = async () => {
    const url = value?.trim();

    if (!url) {
      message.warning("请先输入媒体 URL");
      return;
    }

    if (!isValidUrl(url)) {
      message.error("请输入有效的 URL 地址");
      return;
    }

    // 如果是视频 URL，不需要裁剪，直接设置值
    if (isVideoUrl(url)) {
      message.success("视频 URL 已设置");
      return;
    }

    setLoadingUrl(true);
    try {
      // 通过代理获取图片（避免 CORS 问题）
      const response = await fetch(`/api/fs/proxy-image?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        throw new Error("无法获取图片");
      }

      const blob = await response.blob();

      // 验证是否为图片
      if (!isImageFile(blob as File)) {
        throw new Error("URL 指向的不是图片文件");
      }

      // 验证文件大小
      const isLtMaxSize = blob.size / 1024 / 1024 < imageMaxSize;
      if (!isLtMaxSize) {
        message.error(`图片大小不能超过 ${imageMaxSize}MB！`);
        return;
      }

      // 转换为 File 对象
      const file = new File([blob], "image.png", { type: blob.type });

      if (enableCrop) {
        // 打开裁剪弹窗
        setSelectedFile(file);
        setSelectedUrl(url);
        setCropperVisible(true);
      } else {
        // 直接上传
        await handleUpload(file);
      }
    } catch (error) {
      console.error("加载图片失败:", error);
      message.error("无法加载图片，请检查 URL 是否正确");
    } finally {
      setLoadingUrl(false);
    }
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = (file: RcFile) => {
    const isVideo = isVideoFile(file);
    const isImage = isImageFile(file);

    // 验证文件类型
    if (!isVideo && !isImage) {
      message.error("只能上传图片或视频文件！");
      return false;
    }

    // 根据类型验证文件大小
    const maxSize = isVideo ? videoMaxSize : imageMaxSize;
    const isLtMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLtMaxSize) {
      const fileType = isVideo ? "视频" : "图片";
      message.error(`${fileType}大小不能超过 ${maxSize}MB！`);
      return false;
    }

    // 视频不支持裁剪，直接上传
    if (isVideo) {
      void handleUpload(file);
      return false;
    }

    // 图片根据 enableCrop 决定是否裁剪
    if (enableCrop) {
      setSelectedFile(file);
      setSelectedUrl("");
      setCropperVisible(true);
    } else {
      void handleUpload(file);
    }

    return false; // 阻止自动上传
  };

  /**
   * 上传文件到服务器
   */
  const handleUpload = async (file: File | Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("inputFile", file);

      const response = await axios.post<{
        status: boolean;
        data: string;
        message?: string;
      }>("/api/fs/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.status) {
        const url = response.data.data;
        onChange?.(url);
        message.success("上传成功");
      } else {
        message.error(response.data.message || "上传失败");
      }
    } catch (error) {
      console.error("上传失败:", error);
      message.error("上传失败");
    } finally {
      setUploading(false);
    }
  };

  /**
   * 确认裁剪后上传（内部处理，业务组件无需关心）
   */
  const handleCropperConfirm = async (blob: Blob) => {
    await handleUpload(blob);
    setCropperVisible(false);
    setSelectedFile(null);
    setSelectedUrl("");
  };

  /**
   * 关闭裁剪弹窗
   */
  const handleCropperClose = () => {
    setCropperVisible(false);
    setSelectedFile(null);
    setSelectedUrl("");
  };

  /**
   * 清空媒体
   */
  const handleClear = () => {
    onChange?.("");
  };

  return (
    <div className={`media-upload-container ${className || ""}`}>
      <Space.Compact className="w-full">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={handleUrlChange}
          allowClear
          disabled={disabled || uploading}
          onPressEnter={handleLoadFromUrl}
        />
        {enableCrop && value && !isCurrentValueVideo && (
          <Button
            icon={<ScissorOutlined />}
            disabled={disabled || uploading || loadingUrl}
            onClick={handleLoadFromUrl}
            loading={loadingUrl}
          >
            裁剪
          </Button>
        )}
        <Upload
          beforeUpload={handleFileSelect}
          showUploadList={false}
          accept={accept}
          disabled={disabled || uploading}
        >
          <Button
            icon={<UploadOutlined />}
            disabled={disabled || uploading}
            loading={uploading}
          >
            上传
          </Button>
        </Upload>
        {value && (
          <Button
            icon={<DeleteOutlined />}
            disabled={disabled || uploading}
            onClick={handleClear}
            danger
          >
            清除
          </Button>
        )}
      </Space.Compact>

      {/* 媒体预览 */}
      {showPreview && value && (
        <div className="media-upload-preview">
          {isCurrentValueVideo ? (
            <video
              src={value}
              controls
              muted
              style={{ width: 200, maxWidth: "100%" }}
            />
          ) : (
            <Image
              src={value}
              alt="预览"
              width={200}
              style={{ maxWidth: "100%" }}
            />
          )}
        </div>
      )}

      {/* 裁剪弹窗（内部组件，业务层无需关心） */}
      {enableCrop && (
        <ImageCropper
          open={cropperVisible}
          imageSrc={selectedFile || selectedUrl}
          onClose={handleCropperClose}
          onConfirm={handleCropperConfirm}
          defaultAspectRatio={defaultAspectRatio}
          minCropBoxWidth={minCropBoxWidth}
          minCropBoxHeight={minCropBoxHeight}
          title={cropperTitle || "裁剪图片"}
          allowChangeAspectRatio={allowChangeAspectRatio}
        />
      )}
    </div>
  );
}
